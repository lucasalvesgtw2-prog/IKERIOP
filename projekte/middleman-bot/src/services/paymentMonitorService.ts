import { type Payment, type PrismaClient } from '@prisma/client';
import { toDbString, toDecimal, type Decimal } from '../core/money.js';
import { createLogger } from '../core/logger.js';
import { isPrismaErrorCode, UNIQUE_VIOLATION } from '../infra/prisma.js';
import { getAsset } from '../config/assets.js';
import { type DealState } from '../domain/deal/state.js';
import { type ChainAdapter, type IncomingTransfer } from '../chains/ChainAdapter.js';
import { writeAudit } from './auditService.js';
import { applyTransition } from './dealTransition.js';

const log = createLogger('payment-monitor');

/**
 * Independent verification of incoming payments.
 *
 * The rules this service exists to hold:
 *
 *  * A payment is credited only from a transfer the bot read from a chain
 *    adapter. A screenshot proves nothing, and a user-supplied hash is at most
 *    a hint about where to look.
 *  * One transaction can fund exactly one deal, enforced by
 *    `@@unique([network, txHash])` — the database refuses a second claim even
 *    if this code is wrong.
 *  * Confirmations are counted against the requirement stored on the payment
 *    row, not against current configuration, so lowering the setting cannot
 *    retroactively confirm an old payment.
 *  * An under-payment never becomes CONFIRMED. It stops and goes to staff.
 */
export type CreditOutcome =
  | { kind: 'no_transfer' }
  | { kind: 'duplicate'; txHash: string }
  | { kind: 'underpaid'; txHash: string; received: Decimal; expected: Decimal }
  | { kind: 'detected'; txHash: string; confirmations: number }
  | { kind: 'confirming'; txHash: string; confirmations: number; required: number }
  | { kind: 'confirmed'; txHash: string; confirmations: number };

export class PaymentMonitorService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Picks the transfer that satisfies a payment request.
   *
   * The largest sufficient transfer wins, so a buyer who sent dust first and
   * the real amount second is credited correctly. A transfer already recorded
   * against another payment is skipped here and refused by the database as
   * well.
   */
  selectTransfer(
    transfers: IncomingTransfer[],
    payment: Pick<Payment, 'expectedCryptoAmount' | 'toleranceCryptoAmount'>,
  ): { transfer: IncomingTransfer | null; best: IncomingTransfer | null } {
    const expected = toDecimal(String(payment.expectedCryptoAmount));
    const tolerance = toDecimal(String(payment.toleranceCryptoAmount ?? '0'));
    const minimum = expected.minus(tolerance);

    let sufficient: IncomingTransfer | null = null;
    let best: IncomingTransfer | null = null;

    for (const transfer of transfers) {
      if (!best || transfer.amount.greaterThan(best.amount)) {
        best = transfer;
      }
      if (transfer.amount.greaterThanOrEqualTo(minimum)) {
        if (!sufficient || transfer.amount.greaterThan(sufficient.amount)) {
          sufficient = transfer;
        }
      }
    }

    return { transfer: sufficient, best };
  }

  /**
   * Polls the chain for one payment and advances it.
   *
   * Every state change is a guarded update, so two monitor runs racing on the
   * same payment cannot both credit it.
   */
  async poll(payment: Payment, adapter: ChainAdapter): Promise<CreditOutcome> {
    // A payment already carrying a hash is tracked by hash: re-scanning the
    // address could otherwise pick a different transfer on a later pass.
    if (payment.txHash) {
      return this.advanceConfirmations(payment, adapter);
    }

    const transfers = await adapter.getIncomingTransfers(payment.depositAddress, payment.asset);
    const { transfer, best } = this.selectTransfer(transfers, payment);

    if (!transfer) {
      if (best) {
        await this.markUnderpaid(payment, best);
        return {
          kind: 'underpaid',
          txHash: best.txHash,
          received: best.amount,
          expected: toDecimal(String(payment.expectedCryptoAmount)),
        };
      }
      return { kind: 'no_transfer' };
    }

    return this.credit(payment, transfer, adapter);
  }

  /**
   * Attaches a transfer to a payment.
   *
   * The unique index on (network, txHash) is what actually prevents the same
   * transaction funding two deals; a violation here means another payment won
   * the race, and this one simply keeps waiting.
   */
  private async credit(
    payment: Payment,
    transfer: IncomingTransfer,
    adapter: ChainAdapter,
  ): Promise<CreditOutcome> {
    // Verified independently of the address scan: the hash must exist, be for
    // this chain, and not be a reverted transaction.
    const status = await adapter.getTransactionStatus(transfer.txHash, payment.asset);

    if (!status.found || status.failed) {
      log.warn(
        { paymentId: payment.id, txHash: transfer.txHash, failed: status.failed },
        'ignoring a transfer that does not verify on chain',
      );
      return { kind: 'no_transfer' };
    }

    const confirmations = Math.max(transfer.confirmations, status.confirmations);

    try {
      const updated = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING', txHash: null },
        data: {
          status: 'DETECTED',
          txHash: transfer.txHash,
          fromAddress: transfer.fromAddress ?? null,
          receivedCryptoAmount: toDbString(transfer.amount, 18),
          blockHeight: transfer.blockHeight ?? null,
          confirmations,
          detectedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return { kind: 'duplicate', txHash: transfer.txHash };
      }
    } catch (error) {
      if (isPrismaErrorCode(error, UNIQUE_VIOLATION)) {
        log.warn(
          { paymentId: payment.id, txHash: transfer.txHash },
          'transaction is already credited to another deal',
        );
        return { kind: 'duplicate', txHash: transfer.txHash };
      }
      throw error;
    }

    await this.recordDetection(payment, transfer, confirmations);

    const refreshed = await this.prisma.payment.findUnique({ where: { id: payment.id } });

    return refreshed
      ? this.advanceConfirmations(refreshed, adapter)
      : { kind: 'detected', txHash: transfer.txHash, confirmations };
  }

  /** Re-reads the transaction and moves the deal along as confirmations grow. */
  private async advanceConfirmations(
    payment: Payment,
    adapter: ChainAdapter,
  ): Promise<CreditOutcome> {
    if (!payment.txHash) return { kind: 'no_transfer' };

    const status = await adapter.getTransactionStatus(payment.txHash, payment.asset);

    if (!status.found) {
      // A dropped or re-orged transaction: the confirmation count goes back to
      // zero rather than being remembered optimistically.
      await this.prisma.payment.updateMany({
        where: { id: payment.id },
        data: { confirmations: 0 },
      });
      return { kind: 'detected', txHash: payment.txHash, confirmations: 0 };
    }

    if (status.failed) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id },
        data: { status: 'FAILED', confirmations: 0 },
      });
      return { kind: 'no_transfer' };
    }

    await this.prisma.payment.updateMany({
      where: { id: payment.id },
      data: { confirmations: status.confirmations },
    });

    if (status.confirmations < payment.requiredConfirmations) {
      await this.moveDealTo(payment, 'PAYMENT_CONFIRMING');
      return {
        kind: 'confirming',
        txHash: payment.txHash,
        confirmations: status.confirmations,
        required: payment.requiredConfirmations,
      };
    }

    await this.confirm(payment, status.confirmations);

    return { kind: 'confirmed', txHash: payment.txHash, confirmations: status.confirmations };
  }

  /** Marks the payment confirmed and releases the deal to proceed. */
  private async confirm(payment: Payment, confirmations: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['DETECTED', 'CONFIRMING'] } },
        data: { status: 'CONFIRMED', confirmations, confirmedAt: new Date() },
      });

      if (marked.count === 0) return;

      const deal = await tx.deal.findUnique({ where: { id: payment.dealId } });
      if (!deal) return;

      const status = deal.status as DealState;

      // The deal may be one step behind if a monitor run was interrupted, so
      // both intermediate states are handled.
      if (status === 'PAYMENT_DETECTED') {
        await applyTransition(tx, {
          dealId: deal.id,
          from: 'PAYMENT_DETECTED',
          to: 'PAYMENT_CONFIRMING',
          reason: 'Confirmations reached',
        });
      }

      const current = await tx.deal.findUnique({ where: { id: payment.dealId } });

      if ((current?.status as DealState) === 'PAYMENT_CONFIRMING') {
        await applyTransition(tx, {
          dealId: deal.id,
          from: 'PAYMENT_CONFIRMING',
          to: 'PAYMENT_CONFIRMED',
          reason: `Payment confirmed with ${confirmations} confirmations`,
          data: { paymentTxHash: payment.txHash },
        });

        await writeAudit(tx, {
          action: 'PAYMENT_CONFIRMED',
          dealId: deal.id,
          metadata: {
            txHash: payment.txHash,
            confirmations,
            requiredConfirmations: payment.requiredConfirmations,
            asset: payment.asset,
            network: payment.network,
          },
        });
      }
    });
  }

  private async recordDetection(
    payment: Payment,
    transfer: IncomingTransfer,
    confirmations: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: payment.dealId } });
      if (!deal) return;

      if ((deal.status as DealState) === 'AWAITING_PAYMENT') {
        await applyTransition(tx, {
          dealId: deal.id,
          from: 'AWAITING_PAYMENT',
          to: 'PAYMENT_DETECTED',
          reason: 'Payment detected on chain',
          data: { paymentTxHash: transfer.txHash },
        });
      }

      await writeAudit(tx, {
        action: 'PAYMENT_DETECTED',
        dealId: deal.id,
        metadata: {
          txHash: transfer.txHash,
          amount: transfer.amount.toString(),
          asset: transfer.asset,
          network: transfer.network,
          confirmations,
        },
      });
    });

    log.info(
      { paymentId: payment.id, txHash: transfer.txHash, confirmations },
      'payment detected on chain',
    );
  }

  /**
   * Records a transfer that arrived but is not enough.
   *
   * It deliberately stops here: the deal does not advance, and staff decide
   * what happens. Auto-crediting a short payment would let a buyer under-pay
   * and still receive the goods.
   */
  private async markUnderpaid(payment: Payment, transfer: IncomingTransfer): Promise<void> {
    const asset = getAsset(payment.asset);
    const decimals = asset?.decimals ?? 8;

    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'UNDERPAID',
        txHash: transfer.txHash,
        receivedCryptoAmount: toDbString(transfer.amount, 18),
        fromAddress: transfer.fromAddress ?? null,
        detectedAt: new Date(),
      },
    });

    await writeAudit(this.prisma, {
      action: 'PAYMENT_DETECTED',
      dealId: payment.dealId,
      metadata: {
        underpaid: true,
        txHash: transfer.txHash,
        received: transfer.amount.toFixed(decimals),
        expected: toDecimal(String(payment.expectedCryptoAmount)).toFixed(decimals),
      },
    });

    log.warn(
      {
        paymentId: payment.id,
        received: transfer.amount.toString(),
        expected: String(payment.expectedCryptoAmount),
      },
      'underpayment detected — escalating rather than crediting',
    );
  }

  private async moveDealTo(payment: Payment, to: DealState): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: payment.dealId } });
      if (!deal) return;

      const from = deal.status as DealState;
      if (from === to) return;
      if (from !== 'PAYMENT_DETECTED') return;

      await applyTransition(tx, { dealId: deal.id, from, to, reason: 'Awaiting confirmations' });
    });
  }

  /** Payments the worker should look at on this pass. */
  async pendingPayments(limit = 50): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { status: { in: ['PENDING', 'DETECTED', 'CONFIRMING'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
