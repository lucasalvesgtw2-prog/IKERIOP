import { type PrismaClient } from '@prisma/client';
import { getEnv } from '../config/env.js';
import { availableAssets } from '../config/assets.js';
import { type Decimal, toDecimal } from '../core/money.js';

/**
 * Effective per-guild configuration.
 *
 * A row in `GuildConfig` overrides the `.env` defaults, so an administrator can
 * change the fee or the support role without a redeploy, while a fresh install
 * works from `.env` alone.
 */
export interface ResolvedGuildConfig {
  guildId: string;

  supportRoleId?: string;
  middlemanRoleId?: string;
  adminRoleId?: string;

  ticketCategoryId?: string;
  archiveCategoryId?: string;
  staffLogChannelId?: string;

  feePercentage: Decimal;
  minDealAmountUsd: Decimal;
  maxDealAmountUsd: Decimal;

  /** Asset symbols offered to users, already filtered to the runtime mode. */
  enabledAssets: string[];

  ticketCloseDelaySeconds: number;
}

interface CacheEntry {
  value: ResolvedGuildConfig;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * Configuration is read on nearly every interaction, so it is cached in
 * process for a minute. `invalidate` is called by the admin commands that
 * change it, which keeps the window between a change and its effect at zero
 * for the person making the change.
 */
export class ConfigService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaClient) {}

  async get(guildId: string): Promise<ResolvedGuildConfig> {
    const cached = this.cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await this.prisma.guildConfig.findUnique({ where: { guildId } });
    const value = this.merge(guildId, row);

    this.cache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  private merge(
    guildId: string,
    row: {
      supportRoleId: string | null;
      middlemanRoleId: string | null;
      adminRoleId: string | null;
      ticketCategoryId: string | null;
      archiveCategoryId: string | null;
      staffLogChannelId: string | null;
      feePercentage: unknown;
      minDealAmountUsd: unknown;
      maxDealAmountUsd: unknown;
      enabledAssets: string[];
      ticketCloseDelaySeconds: number;
    } | null,
  ): ResolvedGuildConfig {
    const env = getEnv();

    // Only assets that are actually usable in the current runtime mode are
    // offered, so a development deployment can never present a mainnet-only
    // asset it has no network for.
    const usable = new Set(availableAssets(env.CHAIN_NETWORK_MODE).map((asset) => asset.symbol));
    const configured = row?.enabledAssets?.length
      ? row.enabledAssets
      : ['BTC', 'ETH', 'USDT', 'USDC'];

    // Optional ids are spread in only when set, so an unset value stays
    // `undefined` rather than becoming an empty string that looks like an id.
    const optional = {
      supportRoleId: row?.supportRoleId ?? env.SUPPORT_ROLE_ID,
      middlemanRoleId: row?.middlemanRoleId ?? env.MIDDLEMAN_ROLE_ID,
      adminRoleId: row?.adminRoleId ?? env.ADMIN_ROLE_ID,
      ticketCategoryId: row?.ticketCategoryId ?? env.TICKET_CATEGORY_ID,
      archiveCategoryId: row?.archiveCategoryId ?? env.TICKET_ARCHIVE_CATEGORY_ID,
      staffLogChannelId: row?.staffLogChannelId ?? env.STAFF_LOG_CHANNEL_ID,
    };

    return {
      guildId,
      feePercentage: toDecimal(
        (row?.feePercentage as string | undefined) ?? env.DEFAULT_FEE_PERCENTAGE,
      ),
      minDealAmountUsd: toDecimal(
        (row?.minDealAmountUsd as string | undefined) ?? env.MIN_DEAL_AMOUNT_USD,
      ),
      maxDealAmountUsd: toDecimal(
        (row?.maxDealAmountUsd as string | undefined) ?? env.MAX_DEAL_AMOUNT_USD,
      ),
      enabledAssets: configured.filter((symbol) => usable.has(symbol)),
      ticketCloseDelaySeconds: row?.ticketCloseDelaySeconds ?? env.TICKET_CLOSE_DELAY_SECONDS,
      ...Object.fromEntries(Object.entries(optional).filter(([, value]) => Boolean(value))),
    };
  }
}
