import { type Client, type TextChannel } from 'discord.js';
import { type Payment } from '@prisma/client';
import { createLogger } from '../core/logger.js';
import { toDecimal } from '../core/money.js';
import { getEnv } from '../config/env.js';
import { explorerTxUrl, getAsset } from '../config/assets.js';
import { acquireLock } from '../infra/locks.js';
import {
  buildConfirmationProgressEmbed,
  buildPaymentConfirmedEmbed,
} from '../bot/components/paymentPanels.js';
import { buildCompletionPanel } from '../bot/components/completionPanels.js';
import { type BotContext } from '../bot/interactions/context.js';
import { rotateRenderNonce } from '../bot/interactions/renderNonce.js';
import { type ChainRegistry } from '../chains/index.js';

const log = createLogger('payment-monitor-worker');

/**
 * Background payment monitoring.
 *
 * One pass per interval over every payment that is still open. Each payment is
 * processed under its own lock so a slow chain call cannot make two passes
 * overlap on the same row, and a failure on one payment never stops the rest.
 */
export class PaymentMonitorWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly bot: BotContext,
    private readonly client: Client,
    private readonly chains: ChainRegistry,
    private readonly intervalMs = 20_000,
  ) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        log.error({ err: String(error) }, 'payment monitor pass failed');
      });
    }, this.intervalMs);

    // Unref so a pending timer never keeps the process alive during shutdown.
    this.timer.unref();
    log.info({ intervalMs: this.intervalMs }, 'payment monitor started');
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
    log.info('payment monitor stopped');
  }

  /** Exposed so a test — or an admin command — can force a single pass. */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const payments = await this.bot.paymentMonitor.pendingPayments();

      for (const payment of payments) {
        await this.processPayment(payment).catch((error: unknown) => {
          log.warn(
            { paymentId: payment.id, err: String(error) },
            'failed to process a payment; continuing with the rest',
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async processPayment(payment: Payment): Promise<void> {
    const lock = await acquireLock(this.bot.redis, `lock:payment:${payment.id}`, {
      ttlMs: 60_000,
      waitMs: 0,
    });

    // No wait: another pass already holds it, and the work will happen there.
    if (!lock) return;

    try {
      const adapter = this.chains.get(payment.network);
      const before = payment.status;
      const outcome = await this.bot.paymentMonitor.poll(payment, adapter);

      switch (outcome.kind) {
        case 'no_transfer':
        case 'duplicate':
          return;

        case 'underpaid':
          await this.announceUnderpayment(payment, outcome.received.toString(), outcome.txHash);
          return;

        case 'detected':
        case 'confirming':
          await this.announceProgress(payment, outcome.txHash, outcome.confirmations);
          return;

        case 'confirmed':
          if (before !== 'CONFIRMED') {
            await this.announceConfirmed(payment, outcome.txHash, outcome.confirmations);
          }
          return;
      }
    } finally {
      await lock.release();
    }
  }

  private async channelFor(payment: Payment): Promise<TextChannel | null> {
    const ticket = await this.bot.prisma.ticket.findFirst({
      where: { deal: { id: payment.dealId } },
    });

    if (!ticket) return null;

    const channel = await this.client.channels.fetch(ticket.channelId).catch(() => null);
    return channel && channel.isTextBased() ? (channel as TextChannel) : null;
  }

  private async announceProgress(
    payment: Payment,
    txHash: string,
    confirmations: number,
  ): Promise<void> {
    const channel = await this.channelFor(payment);
    if (!channel) return;

    const deal = await this.bot.prisma.deal.findUnique({ where: { id: payment.dealId } });
    if (!deal) return;

    const url = explorerTxUrl(payment.network, txHash);

    await channel.send({
      embeds: [
        buildConfirmationProgressEmbed({
          publicDealId: deal.publicId,
          assetSymbol: payment.asset,
          confirmations,
          requiredConfirmations: payment.requiredConfirmations,
          txHash,
          ...(url ? { explorerUrl: url } : {}),
        }),
      ],
    });
  }

  /**
   * The confirmation message. Posted only after the monitor has independently
   * read the transaction from the chain and counted enough confirmations.
   */
  private async announceConfirmed(
    payment: Payment,
    txHash: string,
    confirmations: number,
  ): Promise<void> {
    const channel = await this.channelFor(payment);
    if (!channel) return;

    const deal = await this.bot.prisma.deal.findUnique({ where: { id: payment.dealId } });
    if (!deal) return;

    const env = getEnv();
    const url = explorerTxUrl(payment.network, txHash);

    await channel.send({
      embeds: [
        buildConfirmationProgressEmbed({
          publicDealId: deal.publicId,
          assetSymbol: payment.asset,
          confirmations,
          requiredConfirmations: payment.requiredConfirmations,
          txHash,
          ...(url ? { explorerUrl: url } : {}),
        }),
        buildPaymentConfirmedEmbed({
          publicDealId: deal.publicId,
          buyerTotalUsd: toDecimal(String(deal.buyerTotalUsd ?? '0')),
          isMockMode: !env.LIVE_MODE,
        }),
      ],
      content: [deal.buyerDiscordId, deal.sellerDiscordId]
        .filter(Boolean)
        .map((id) => `<@${id}>`)
        .join(' '),
      allowedMentions: {
        users: [deal.buyerDiscordId, deal.sellerDiscordId].filter((id): id is string =>
          Boolean(id),
        ),
      },
    });

    // Release the deposit address back to the pool now that it has served its
    // deal; a confirmed payment will not receive anything else.
    if (payment.walletId) {
      await this.bot.wallets.releaseDepositAddress(payment.walletId).catch(() => undefined);
    }

    await this.openCompletionStep(payment.dealId, channel);
  }

  /** Moves the deal into the "carry out the deal" phase and posts the panel. */
  private async openCompletionStep(dealId: string, channel: TextChannel): Promise<void> {
    const deal = await this.bot.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.status !== 'PAYMENT_CONFIRMED') return;

    const inProgress = await this.bot.completion.beginDeal({ deal });
    const nonce = await rotateRenderNonce(this.bot.redis, deal.id);

    const message = await channel.send(
      buildCompletionPanel({
        publicDealId: inProgress.publicId,
        buyerDiscordId: inProgress.buyerDiscordId ?? '',
        sellerDiscordId: inProgress.sellerDiscordId ?? '',
        buyerConfirmed: false,
        sellerConfirmed: false,
        nonce,
      }),
    );

    await this.bot.prisma.deal.update({
      where: { id: deal.id },
      data: { statusMessageId: message.id },
    });
  }

  private async announceUnderpayment(
    payment: Payment,
    received: string,
    txHash: string,
  ): Promise<void> {
    const channel = await this.channelFor(payment);
    if (!channel) return;

    const deal = await this.bot.prisma.deal.findUnique({ where: { id: payment.dealId } });
    if (!deal) return;

    const config = await this.bot.config.get(deal.guildId);
    const asset = getAsset(payment.asset);
    const decimals = asset?.decimals ?? 8;

    await channel.send({
      content: config.supportRoleId ? `<@&${config.supportRoleId}>` : '',
      embeds: [
        {
          color: 0xf1c40f,
          title: '⚠️ Payment received, but it is not enough',
          description: [
            'A transfer arrived at the payment address, but it is below the required amount.',
            '',
            `**Received:** \`${toDecimal(received).toFixed(decimals)} ${payment.asset}\``,
            `**Required:** \`${toDecimal(String(payment.expectedCryptoAmount)).toFixed(decimals)} ${payment.asset}\``,
            `**Transaction:** \`${txHash}\``,
            '',
            'The deal has **not** continued. No funds will be released automatically.',
            'Please contact support to resolve this.',
          ].join('\n'),
        },
      ],
      allowedMentions: config.supportRoleId ? { roles: [config.supportRoleId] } : { parse: [] },
    });
  }
}
