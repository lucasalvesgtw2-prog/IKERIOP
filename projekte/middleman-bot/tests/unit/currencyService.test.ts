import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../src/core/errors.js';
import { CurrencyService, decodePair, encodePair } from '../../src/services/currencyService.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const ENABLED = ['BTC', 'ETH', 'USDT', 'USDC'];

function seedDeal(
  prisma: ReturnType<typeof createFakePrisma>,
  overrides: Record<string, unknown> = {},
) {
  const deal = {
    id: 'deal-1',
    publicId: 'MM-0001',
    creatorDiscordId: 'buyer-1',
    buyerDiscordId: 'buyer-1',
    sellerDiscordId: 'seller-1',
    status: 'CURRENCY_SELECTION',
    buyerAsset: null,
    buyerNetwork: null,
    sellerAsset: null,
    sellerNetwork: null,
    version: 0,
    ...overrides,
  };
  prisma.state.deals.push(deal);
  return deal;
}

describe('pair encoding', () => {
  it('round-trips', () => {
    expect(decodePair(encodePair('USDT', 'tron'))).toEqual({ asset: 'USDT', network: 'tron' });
  });

  it('rejects a malformed value rather than guessing', () => {
    for (const bad of ['', 'USDT', 'USDT|', '|tron', 'a|b|c']) {
      expect(() => decodePair(bad), bad).toThrow(ValidationError);
    }
  });
});

describe('resolveSelection', () => {
  const service = new CurrencyService(createFakePrisma() as never);

  it('accepts a valid mainnet pair in mainnet mode', () => {
    const pair = service.resolveSelection('USDT', 'tron', ENABLED, 'mainnet');
    expect(pair.asset.symbol).toBe('USDT');
    expect(pair.network.id).toBe('tron');
    expect(pair.contract).toBeDefined();
  });

  it('rejects an asset/network combination that would lose funds', () => {
    expect(() => service.resolveSelection('BTC', 'ethereum', ENABLED, 'mainnet')).toThrow(
      ValidationError,
    );
    expect(() => service.resolveSelection('ETH', 'tron', ENABLED, 'mainnet')).toThrow(
      ValidationError,
    );
  });

  it('rejects an unknown asset or network', () => {
    expect(() => service.resolveSelection('DOGE', 'bitcoin', ENABLED, 'mainnet')).toThrow(
      ValidationError,
    );
    expect(() => service.resolveSelection('BTC', 'not-a-chain', ENABLED, 'mainnet')).toThrow(
      ValidationError,
    );
  });

  it('rejects an asset the guild has disabled', () => {
    expect(() => service.resolveSelection('BTC', 'bitcoin', ['USDT'], 'mainnet')).toThrow(
      ValidationError,
    );
  });

  it('refuses a mainnet network while running in mock or testnet mode', () => {
    for (const mode of ['mock', 'testnet'] as const) {
      expect(() => service.resolveSelection('BTC', 'bitcoin', ENABLED, mode), mode).toThrow(
        ValidationError,
      );
      expect(() => service.resolveSelection('USDT', 'tron', ENABLED, mode), mode).toThrow(
        ValidationError,
      );
    }
  });

  it('accepts the testnet equivalents in mock and testnet mode', () => {
    for (const mode of ['mock', 'testnet'] as const) {
      expect(
        service.resolveSelection('BTC', 'bitcoin-testnet', ENABLED, mode).network.testnet,
      ).toBe(true);
    }
  });

  it('refuses a testnet network in mainnet mode', () => {
    expect(() => service.resolveSelection('BTC', 'bitcoin-testnet', ENABLED, 'mainnet')).toThrow(
      ValidationError,
    );
  });
});

describe('setCurrency', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: CurrencyService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new CurrencyService(prisma as never);
  });

  function pair(asset: string, network: string) {
    return service.resolveSelection(asset, network, ENABLED, 'mainnet');
  }

  it('stores the buyer rail without touching the seller rail', async () => {
    const deal = seedDeal(prisma);

    const updated = await service.setCurrency({
      deal: deal as never,
      role: 'buyer',
      pair: pair('USDT', 'tron'),
      actorDiscordId: 'buyer-1',
    });

    expect(updated.buyerAsset).toBe('USDT');
    expect(updated.buyerNetwork).toBe('tron');
    expect(updated.sellerAsset).toBeNull();
  });

  it('supports the buyer and the seller using different currencies', async () => {
    const deal = seedDeal(prisma);

    await service.setCurrency({
      deal: deal as never,
      role: 'buyer',
      pair: pair('USDT', 'tron'),
      actorDiscordId: 'buyer-1',
    });
    const updated = await service.setCurrency({
      deal: prisma.state.deals[0] as never,
      role: 'seller',
      pair: pair('BTC', 'bitcoin'),
      actorDiscordId: 'seller-1',
    });

    expect(updated.buyerAsset).toBe('USDT');
    expect(updated.sellerAsset).toBe('BTC');
    expect(service.bothCurrenciesSelected(updated)).toBe(true);
  });

  it('supports both sides using the same currency', async () => {
    const deal = seedDeal(prisma);
    await service.setCurrency({
      deal: deal as never,
      role: 'buyer',
      pair: pair('BTC', 'bitcoin'),
      actorDiscordId: 'buyer-1',
    });
    const updated = await service.setCurrency({
      deal: prisma.state.deals[0] as never,
      role: 'seller',
      pair: pair('BTC', 'bitcoin'),
      actorDiscordId: 'seller-1',
    });

    expect(service.bothCurrenciesSelected(updated)).toBe(true);
  });

  it('records the choice in the audit trail under the right action', async () => {
    const deal = seedDeal(prisma);
    await service.setCurrency({
      deal: deal as never,
      role: 'buyer',
      pair: pair('USDT', 'tron'),
      actorDiscordId: 'buyer-1',
    });
    expect(prisma.state.auditLogs.at(-1)!.action).toBe('PAYMENT_CURRENCY_SELECTED');

    await service.setCurrency({
      deal: prisma.state.deals[0] as never,
      role: 'seller',
      pair: pair('BTC', 'bitcoin'),
      actorDiscordId: 'seller-1',
    });
    expect(prisma.state.auditLogs.at(-1)!.action).toBe('PAYOUT_CURRENCY_SELECTED');
  });

  it('lets a party change their mind while the step is still open', async () => {
    const deal = seedDeal(prisma);
    await service.setCurrency({
      deal: deal as never,
      role: 'buyer',
      pair: pair('USDT', 'tron'),
      actorDiscordId: 'buyer-1',
    });
    const updated = await service.setCurrency({
      deal: prisma.state.deals[0] as never,
      role: 'buyer',
      pair: pair('BTC', 'bitcoin'),
      actorDiscordId: 'buyer-1',
    });

    expect(updated.buyerAsset).toBe('BTC');
  });

  it('refuses once the deal has left the currency step', async () => {
    const deal = seedDeal(prisma, { status: 'AWAITING_PAYMENT' });

    await expect(
      service.setCurrency({
        deal: deal as never,
        role: 'buyer',
        pair: pair('BTC', 'bitcoin'),
        actorDiscordId: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('beginSelection', () => {
  it('moves an approved deal into CURRENCY_SELECTION', async () => {
    const prisma = createFakePrisma();
    const service = new CurrencyService(prisma as never);
    const deal = seedDeal(prisma, { status: 'BUYER_APPROVED' });

    const updated = await service.beginSelection({
      deal: deal as never,
      actorDiscordId: 'buyer-1',
    });

    expect(updated.status).toBe('CURRENCY_SELECTION');
  });

  it('refuses before the buyer has approved', async () => {
    const prisma = createFakePrisma();
    const service = new CurrencyService(prisma as never);
    const deal = seedDeal(prisma, { status: 'WAITING_FOR_BUYER_APPROVAL' });

    await expect(
      service.beginSelection({ deal: deal as never, actorDiscordId: 'buyer-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('pair readers', () => {
  const service = new CurrencyService(createFakePrisma() as never);

  it('return null until a rail is chosen', () => {
    const deal = { buyerAsset: null, buyerNetwork: null, sellerAsset: null, sellerNetwork: null };
    expect(service.buyerPair(deal as never)).toBeNull();
    expect(service.sellerPair(deal as never)).toBeNull();
    expect(service.bothCurrenciesSelected(deal as never)).toBe(false);
  });

  it('resolve a stored rail back to its definition', () => {
    const deal = {
      buyerAsset: 'USDT',
      buyerNetwork: 'tron',
      sellerAsset: 'BTC',
      sellerNetwork: 'bitcoin',
    };
    expect(service.buyerPair(deal as never)?.network.label).toBe('Tron (TRC20)');
    expect(service.sellerPair(deal as never)?.asset.decimals).toBe(8);
  });
});
