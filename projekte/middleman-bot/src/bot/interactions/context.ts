import { type Client, type Guild, type GuildMember } from 'discord.js';
import { type PrismaClient } from '@prisma/client';
import { type Redis } from 'ioredis';
import { ConfigService, type ResolvedGuildConfig } from '../../services/configService.js';
import { TicketService } from '../../services/ticketService.js';
import { DealService } from '../../services/dealService.js';
import { DealDetailsService } from '../../services/dealDetailsService.js';
import { CurrencyService } from '../../services/currencyService.js';
import { WalletService } from '../../services/walletService.js';
import { PaymentService } from '../../services/paymentService.js';
import { PaymentMonitorService } from '../../services/paymentMonitorService.js';
import { CompletionService } from '../../services/completionService.js';
import { PayoutService } from '../../services/payoutService.js';
import { DisputeService } from '../../services/disputeService.js';
import { createSigner, type Signer } from '../../wallets/index.js';
import { ChainRegistry } from '../../chains/index.js';
import { createPriceProvider, type PriceProvider } from '../../prices/index.js';
import { newUuid } from '../../core/ids.js';

/**
 * Everything a handler is allowed to touch.
 *
 * Handlers receive this instead of reaching for module-level singletons, which
 * is what lets them be exercised in tests with stubs.
 */
export interface BotContext {
  client: Client;
  prisma: PrismaClient;
  redis: Redis;
  config: ConfigService;
  tickets: TicketService;
  deals: DealService;
  dealDetails: DealDetailsService;
  currencies: CurrencyService;
  wallets: WalletService;
  payments: PaymentService;
  paymentMonitor: PaymentMonitorService;
  completion: CompletionService;
  payouts: PayoutService;
  disputes: DisputeService;
  chains: ChainRegistry;
  signer: Signer;
  prices: PriceProvider;
}

export function createBotContext(params: {
  client: Client;
  prisma: PrismaClient;
  redis: Redis;
}): BotContext {
  const prices = createPriceProvider(params.redis);
  const wallets = new WalletService(params.prisma);
  const signer = createSigner(params.redis);

  return {
    client: params.client,
    prisma: params.prisma,
    redis: params.redis,
    config: new ConfigService(params.prisma),
    tickets: new TicketService(params.prisma),
    deals: new DealService(params.prisma),
    dealDetails: new DealDetailsService(params.prisma),
    currencies: new CurrencyService(params.prisma),
    wallets,
    payments: new PaymentService(params.prisma, prices, wallets),
    paymentMonitor: new PaymentMonitorService(params.prisma),
    completion: new CompletionService(params.prisma),
    payouts: new PayoutService(params.prisma, prices, signer),
    disputes: new DisputeService(params.prisma),
    chains: new ChainRegistry(params.redis),
    signer,
    prices,
  };
}

/** Per-interaction state, so every log line and audit row can be correlated. */
export interface InteractionContext {
  bot: BotContext;
  guild: Guild;
  member: GuildMember;
  guildConfig: ResolvedGuildConfig;
  /** Ties together every log and audit row written for this interaction. */
  correlationId: string;
}

export function newCorrelationId(): string {
  return newUuid();
}
