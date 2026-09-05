import { type Deal, type PrismaClient } from '@prisma/client';
import { ConflictError, ValidationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { resolvePair, type AssetNetworkPair } from '../config/assets.js';
import { type DealState } from '../domain/deal/state.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';

const log = createLogger('currency-service');

/**
 * Settlement currency selection.
 *
 * The buyer's payment rail and the seller's payout rail are independent: the
 * buyer may pay USDT on TRC20 while the seller receives BTC. Both are recorded
 * as an (asset, network) pair, because "USDT" alone is not a destination —
 * sending TRC20 USDT to an ERC20 address loses the funds.
 *
 * Nothing here touches the deal's value. The deal is worth its USD amount
 * whatever rails the parties pick.
 */

export type CurrencyRole = 'buyer' | 'seller';

export class CurrencyService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Validates a selection against the registry and the guild's enabled assets.
   *
   * A select menu's values are client-controlled, so the pair is re-resolved
   * here rather than trusted: an asset the guild disabled, or an (asset,
   * network) combination that does not exist, is rejected outright.
   */
  resolveSelection(
    assetSymbol: string,
    networkId: string,
    enabledAssets: string[],
    mode: 'mock' | 'testnet' | 'mainnet',
  ): AssetNetworkPair {
    const pair = resolvePair(assetSymbol, networkId);

    if (!pair) {
      throw new ValidationError(
        `Invalid asset/network pair ${assetSymbol}/${networkId}`,
        'That cryptocurrency and network combination is not supported.',
      );
    }

    if (!enabledAssets.includes(pair.asset.symbol)) {
      throw new ValidationError(
        `Asset ${pair.asset.symbol} is not enabled for this guild`,
        `${pair.asset.symbol} is not available on this server.`,
      );
    }

    // A development deployment must never be able to name a mainnet network.
    const wantTestnet = mode !== 'mainnet';
    if (pair.network.testnet !== wantTestnet) {
      throw new ValidationError(
        `Network ${pair.network.id} does not match runtime mode ${mode}`,
        'That network is not available in the current mode.',
      );
    }

    return pair;
  }

  /** Opens the currency step once the buyer has approved the deal. */
  async beginSelection(input: {
    deal: Deal;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['BUYER_APPROVED']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'BUYER_APPROVED',
        to: 'CURRENCY_SELECTION',
        actorDiscordId: input.actorDiscordId,
        reason: 'Currency selection opened',
      }),
    );
  }

  /**
   * Records one side's currency choice.
   *
   * Both choices are plain column writes inside the CURRENCY_SELECTION state,
   * not transitions: the order the two parties answer in does not matter, and
   * either may change their mind until the payment request is created.
   */
  async setCurrency(input: {
    deal: Deal;
    role: CurrencyRole;
    pair: AssetNetworkPair;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(
      input.deal.status as DealState,
      ['CURRENCY_SELECTION'],
      'The currencies for this deal can no longer be changed.',
    );

    const data =
      input.role === 'buyer'
        ? { buyerAsset: input.pair.asset.symbol, buyerNetwork: input.pair.network.id }
        : { sellerAsset: input.pair.asset.symbol, sellerNetwork: input.pair.network.id };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.updateMany({
        where: { id: input.deal.id, status: 'CURRENCY_SELECTION' },
        data: { ...data, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        throw new ConflictError(
          `Deal ${input.deal.id} left CURRENCY_SELECTION before the choice was saved`,
          'This deal has already moved on. Please use the latest message in this ticket.',
        );
      }

      await writeAudit(tx, {
        action: input.role === 'buyer' ? 'PAYMENT_CURRENCY_SELECTED' : 'PAYOUT_CURRENCY_SELECTED',
        dealId: input.deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: { asset: input.pair.asset.symbol, network: input.pair.network.id },
      });

      const deal = await tx.deal.findUnique({ where: { id: input.deal.id } });

      if (!deal) {
        throw new ConflictError(
          `Deal ${input.deal.id} disappeared while saving a currency choice`,
          'This deal could not be updated. Please contact support.',
        );
      }

      log.info(
        {
          dealId: deal.id,
          role: input.role,
          asset: input.pair.asset.symbol,
          network: input.pair.network.id,
        },
        'currency selected',
      );

      return deal;
    });
  }

  /** True once both sides have chosen a valid rail. */
  bothCurrenciesSelected(deal: Deal): boolean {
    return Boolean(deal.buyerAsset && deal.buyerNetwork && deal.sellerAsset && deal.sellerNetwork);
  }

  /** The buyer's payment rail, or `null` before it is chosen. */
  buyerPair(deal: Deal): AssetNetworkPair | null {
    if (!deal.buyerAsset || !deal.buyerNetwork) return null;
    return resolvePair(deal.buyerAsset, deal.buyerNetwork) ?? null;
  }

  /** The seller's payout rail, or `null` before it is chosen. */
  sellerPair(deal: Deal): AssetNetworkPair | null {
    if (!deal.sellerAsset || !deal.sellerNetwork) return null;
    return resolvePair(deal.sellerAsset, deal.sellerNetwork) ?? null;
  }
}

/**
 * Encoding for a select option value.
 *
 * One menu lists complete (asset, network) pairs rather than asking for an
 * asset and then a network. That removes an intermediate state entirely, and
 * with it the possibility of an asset and a network arriving mismatched.
 */
export const PAIR_SEPARATOR = '|';

export function encodePair(assetSymbol: string, networkId: string): string {
  return `${assetSymbol}${PAIR_SEPARATOR}${networkId}`;
}

export function decodePair(value: string): { asset: string; network: string } {
  const parts = value.split(PAIR_SEPARATOR);

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ValidationError(
      `Malformed currency selection "${value}"`,
      'That selection could not be read. Please choose again.',
    );
  }

  return { asset: parts[0], network: parts[1] };
}
