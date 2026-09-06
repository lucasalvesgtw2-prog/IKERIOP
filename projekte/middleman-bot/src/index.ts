import { type Client } from 'discord.js';
import { getEnv, EnvValidationError } from './config/env.js';
import { ConfigurationError } from './core/errors.js';
import { createLogger, getLogger } from './core/logger.js';
import { connectPrisma, disconnectPrisma, getPrisma } from './infra/prisma.js';
import { connectRedis, disconnectRedis, getRedis } from './infra/redis.js';
import { createDiscordClient, loginDiscordClient } from './bot/client.js';
import { createBotContext } from './bot/interactions/context.js';
import { registerInteractionRouter } from './bot/interactions/router.js';
import { registerCommands } from './bot/registerCommands.js';
import { ChainRegistry } from './chains/index.js';
import { PaymentMonitorWorker } from './workers/paymentMonitor.js';
import { PayoutMonitorWorker } from './workers/payoutMonitor.js';

/**
 * Application entrypoint.
 *
 * Startup order matters: the environment is validated before anything else so
 * a misconfigured deployment fails immediately and loudly instead of half
 * starting and touching money later.
 */
async function main(): Promise<void> {
  const env = getEnv();
  const log = createLogger('bootstrap');

  log.info(
    {
      nodeEnv: env.NODE_ENV,
      liveMode: env.LIVE_MODE,
      chainMode: env.CHAIN_NETWORK_MODE,
      priceProvider: env.PRICE_PROVIDER,
      signerBackend: env.SIGNER_BACKEND,
      feePercentage: env.DEFAULT_FEE_PERCENTAGE,
    },
    'starting middleman bot',
  );

  if (!env.LIVE_MODE) {
    log.warn('LIVE_MODE is disabled — running with mock/testnet adapters. No real funds can move.');
  }

  await connectPrisma();
  await connectRedis();

  const client: Client = createDiscordClient();

  const bot = createBotContext({ client, prisma: getPrisma(), redis: getRedis() });
  registerInteractionRouter(client, bot);

  client.once('clientReady', (ready) => {
    log.info({ user: ready.user.tag, guilds: ready.guilds.cache.size }, 'bot ready');
  });

  await loginDiscordClient(client);

  // Registered after login so a bad token fails on login rather than here.
  await registerCommands();

  const chains = new ChainRegistry(getRedis());

  // Reconciliation runs BEFORE any worker starts: a payout that may already be
  // in flight has to be resolved against the signer before new work begins.
  const payoutMonitor = new PayoutMonitorWorker(bot, client, chains);
  await payoutMonitor.reconcileOnBoot();
  payoutMonitor.start();

  const paymentMonitor = new PaymentMonitorWorker(bot, client, chains);
  paymentMonitor.start();

  registerShutdownHandlers(client, () => {
    paymentMonitor.stop();
    payoutMonitor.stop();
  });
}

function registerShutdownHandlers(client: Client, stopWorkers: () => void): void {
  const log = createLogger('shutdown');
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info({ signal }, 'shutting down');

    // Workers stop first so no new chain work starts while connections close.
    stopWorkers();

    // Destroying the gateway first stops new interactions from arriving while
    // in-flight database work finishes.
    try {
      await client.destroy();
    } catch (error) {
      log.warn({ err: String(error) }, 'error while destroying discord client');
    }

    await Promise.allSettled([disconnectRedis(), disconnectPrisma()]);
    log.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    getLogger().error({ err: String(reason) }, 'unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    getLogger().fatal({ err: error.message, stack: error.stack }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}

main().catch((error: unknown) => {
  // A configuration problem is the operator's to fix, so it is printed as a
  // plain, actionable line rather than a stringified error object.
  if (error instanceof ConfigurationError) {
    process.stderr.write(`\nStartup failed: ${error.message}\n\n`);
    process.exit(1);
  }

  if (error instanceof EnvValidationError) {
    // The logger itself depends on a valid environment, so this one message is
    // written directly to stderr.
    process.stderr.write(`\n${error.message}\n\nSee .env.example for the expected values.\n\n`);
    process.exit(1);
  }

  getLogger().fatal({ err: String(error) }, 'fatal startup error');
  process.exit(1);
});
