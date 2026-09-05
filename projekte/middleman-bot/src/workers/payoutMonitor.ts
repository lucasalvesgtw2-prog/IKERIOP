import { type Client, type TextChannel } from 'discord.js';
import { type Payout } from '@prisma/client';
import { createLogger } from '../core/logger.js';
import { getEnv } from '../config/env.js';
import { explorerTxUrl } from '../config/assets.js';
import { acquireLock, payoutLockKey } from '../infra/locks.js';
import { buildReceiptPanel } from '../bot/components/payoutPanels.js';
import { rotateRenderNonce } from '../bot/interactions/renderNonce.js';
import { type BotContext } from '../bot/interactions/context.js';
import { type ChainRegistry } from '../chains/index.js';

const log = createLogger('payout-monitor-worker');

/**
 * Tracks broadcast payouts to confirmation.
 *
 * The important part is `reconcileOnBoot`: before this worker does anything
 * else, every payout that might have a transaction in flight is checked
 * against the signer. A crash immediately after broadcasting is resolved by
 * finding the existing transaction — never by sending a second one.
 */
export class PayoutMonitorWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly bot: BotContext,
    private readonly client: Client,
    private readonly chains: ChainRegistry,
    private readonly intervalMs = 30_000,
  ) {}

  /** Must be awaited before the worker starts polling. */
  async reconcileOnBoot(): Promise<void> {
    const result = await this.bot.payouts.reconcile();

    if (result.recovered > 0) {
      log.warn(result, 'recovered in-flight payouts on boot — no duplicate payouts were sent');
    } else {
      log.info(result, 'payout reconciliation complete');
    }
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        log.error({ err: String(error) }, 'payout monitor pass failed');
      });
    }, this.intervalMs);

    this.timer.unref();
    log.info({ intervalMs: this.intervalMs }, 'payout monitor started');
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      for (const payout of await this.bot.payouts.inFlightPayouts()) {
        await this.processPayout(payout).catch((error: unknown) => {
          log.warn(
            { payoutId: payout.id, err: String(error) },
            'failed to track a payout; continuing with the rest',
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async processPayout(payout: Payout): Promise<void> {
    const lock = await acquireLock(this.bot.redis, payoutLockKey(payout.dealId), {
      ttlMs: 60_000,
      waitMs: 0,
    });

    if (!lock) return;

    try {
      const adapter = this.chains.get(payout.network);
      const before = payout.status;
      const updated = await this.bot.payouts.trackConfirmations(payout, adapter);

      if (updated.status === 'CONFIRMED' && before !== 'CONFIRMED') {
        await this.announceConfirmed(payout);
      }
    } finally {
      await lock.release();
    }
  }

  /** Posts the confirmation and asks the seller whether the funds arrived. */
  private async announceConfirmed(payout: Payout): Promise<void> {
    const deal = await this.bot.prisma.deal.findUnique({ where: { id: payout.dealId } });
    if (!deal) return;

    const ticket = await this.bot.prisma.ticket.findUnique({ where: { id: deal.ticketId } });
    if (!ticket) return;

    const channel = await this.client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const text = channel as TextChannel;
    const nonce = await rotateRenderNonce(this.bot.redis, deal.id);
    const env = getEnv();
    const url = payout.txHash ? explorerTxUrl(payout.network, payout.txHash) : undefined;

    await text.send({
      ...buildReceiptPanel({
        publicDealId: deal.publicId,
        sellerDiscordId: deal.sellerDiscordId ?? '',
        nonce,
      }),
      allowedMentions: { users: deal.sellerDiscordId ? [deal.sellerDiscordId] : [] },
    });

    if (url && !env.LIVE_MODE) {
      log.info({ dealId: deal.id, txHash: payout.txHash }, 'simulated payout confirmed');
    }
  }
}
