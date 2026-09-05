/**
 * Test environment.
 *
 * Unit tests exercise pure logic and stubs, but importing a service pulls in
 * the logger, which needs a valid configuration. These are deliberately
 * obvious fake values — a test must never be able to reach a real Discord,
 * database or price endpoint.
 */
process.env.NODE_ENV = 'test';
process.env.DISCORD_BOT_TOKEN ??= 'test-token-not-a-real-token';
process.env.DISCORD_CLIENT_ID ??= '100000000000000001';
process.env.DISCORD_GUILD_ID ??= '100000000000000002';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test?schema=public';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.LOG_LEVEL ??= 'fatal';
process.env.LOG_PRETTY ??= 'false';
process.env.LIVE_MODE ??= 'false';
process.env.CHAIN_NETWORK_MODE ??= 'mock';
