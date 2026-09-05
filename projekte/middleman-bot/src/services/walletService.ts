import { type PrismaClient, type Wallet } from '@prisma/client';
import { ConfigurationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { getEnv } from '../config/env.js';

const log = createLogger('wallet-service');

/**
 * Deposit and treasury addresses.
 *
 * Addresses are configured data, never source code: `/admin wallet add` writes
 * them, and this service hands them out. The model stores public addresses and
 * an opaque `signerRef` only — no key material of any kind lives in the
 * database, so a database compromise cannot move funds.
 */
export class WalletService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Reserves a deposit address for a payment.
   *
   * A free address is preferred so two open deals never share one: shared
   * addresses make it ambiguous which deal an incoming transfer belongs to.
   * When the pool is exhausted the request fails rather than reusing an
   * address that is already expecting money.
   */
  async reserveDepositAddress(asset: string, network: string): Promise<Wallet> {
    return this.prisma.$transaction(async (tx) => {
      const available = await tx.wallet.findFirst({
        where: { kind: 'DEPOSIT', asset, network, active: true, inUse: false },
        orderBy: { createdAt: 'asc' },
      });

      if (!available) {
        throw new ConfigurationError(`No free deposit address for ${asset} on ${network}`, {
          asset,
          network,
        });
      }

      // Guarded so two concurrent reservations cannot claim the same address.
      const claimed = await tx.wallet.updateMany({
        where: { id: available.id, inUse: false },
        data: { inUse: true },
      });

      if (claimed.count === 0) {
        throw new ConfigurationError(`Deposit address ${available.id} was claimed concurrently`, {
          asset,
          network,
        });
      }

      log.info({ walletId: available.id, asset, network }, 'deposit address reserved');
      return { ...available, inUse: true };
    });
  }

  /** Returns an address to the pool once its deal has settled. */
  async releaseDepositAddress(walletId: string): Promise<void> {
    await this.prisma.wallet.updateMany({
      where: { id: walletId },
      data: { inUse: false },
    });
  }

  /** The treasury address payouts are sent from. */
  async treasuryWallet(asset: string, network: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { kind: 'TREASURY', asset, network, active: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!wallet) {
      throw new ConfigurationError(`No treasury wallet for ${asset} on ${network}`, {
        asset,
        network,
      });
    }

    return wallet;
  }

  async list(kind?: 'DEPOSIT' | 'TREASURY'): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { asset: 'asc' }, { network: 'asc' }],
    });
  }

  /**
   * Registers an address.
   *
   * The address itself is validated by the chain adapter before it gets here,
   * so an address for the wrong network can never enter the pool.
   */
  async add(input: {
    kind: 'DEPOSIT' | 'TREASURY';
    asset: string;
    network: string;
    address: string;
    label?: string;
    signerRef?: string;
  }): Promise<Wallet> {
    const env = getEnv();

    if (!env.LIVE_MODE && input.kind === 'TREASURY') {
      log.warn(
        { asset: input.asset, network: input.network },
        'registering a treasury wallet while LIVE_MODE is disabled — payouts stay simulated',
      );
    }

    return this.prisma.wallet.create({
      data: {
        kind: input.kind,
        asset: input.asset,
        network: input.network,
        address: input.address,
        label: input.label ?? null,
        signerRef: input.signerRef ?? null,
      },
    });
  }

  async setActive(walletId: string, active: boolean): Promise<void> {
    await this.prisma.wallet.update({ where: { id: walletId }, data: { active } });
  }
}
