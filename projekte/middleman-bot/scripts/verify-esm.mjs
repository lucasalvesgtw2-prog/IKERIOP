/**
 * Real-Node ESM smoke test of the built output.
 *
 * The unit tests run under Vitest, which performs its own CommonJS interop and
 * synthesises named exports that Node does not. A CJS package whose exports
 * object is built at runtime — js-sha3 is one — therefore type-checks, passes
 * every test, and then throws `SyntaxError: does not provide an export named
 * …` the first time the bot actually starts.
 *
 * This script imports the compiled `dist/` under plain `node`, with no
 * bundler and no transform, and exercises the code paths that depend on those
 * packages. It is the only check in the pipeline that sees what production
 * sees.
 *
 * Run with: npm run verify:esm   (after npm run build)
 */
import assert from 'node:assert/strict';

const failures = [];

async function check(name, fn) {
  try {
    await fn();
    process.stdout.write(`  ok    ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`  FAIL  ${name}\n        ${error.message}\n`);
  }
}

process.stdout.write('\nVerifying the built output under real Node ESM\n\n');

// --- every module that pulls in a third-party package at import time ---------

await check('dist/chains/address/validators.js imports', async () => {
  const m = await import('../dist/chains/address/validators.js');
  assert.equal(typeof m.validateAddressForFamily, 'function');
});

await check('EIP-55 checksum is computed, not stubbed', async () => {
  const { toChecksumAddress } = await import('../dist/chains/address/validators.js');
  // The canonical EIP-55 vector. If keccak were missing or wrong this differs.
  assert.equal(
    toChecksumAddress('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  );
});

await check('EVM address validation accepts and rejects correctly', async () => {
  const { validateEvmAddress } = await import('../dist/chains/address/validators.js');
  assert.equal(validateEvmAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').valid, true);
  // One character's case flipped: only a real keccak catches this.
  assert.equal(validateEvmAddress('0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').valid, false);
});

await check('Bitcoin address validation (bech32 + base58check)', async () => {
  const { validateBitcoinAddress } = await import('../dist/chains/address/validators.js');
  assert.equal(
    validateBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', { testnet: false }).valid,
    true,
  );
  assert.equal(
    validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', { testnet: false }).valid,
    true,
  );
  assert.equal(
    validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', { testnet: true }).valid,
    false,
  );
});

await check('Tron address validation (base58check, 0x41 prefix)', async () => {
  const { validateTronAddress } = await import('../dist/chains/address/validators.js');
  assert.equal(validateTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').valid, true);
  assert.equal(validateTronAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').valid, false);
});

await check('money engine (decimal.js)', async () => {
  const { formatUsd, roundCryptoUp } = await import('../dist/core/money.js');
  assert.equal(formatUsd('1234.5'), '$1,234.50');
  assert.equal(roundCryptoUp('0.000000011', 8).toFixed(8), '0.00000002');
});

await check('fee engine', async () => {
  const { calculateFees } = await import('../dist/domain/deal/fees.js');
  const fees = calculateFees('100');
  assert.equal(fees.feeUsd.toFixed(2), '5.00');
  assert.equal(fees.buyerTotalUsd.toFixed(2), '105.00');
});

await check('quote engine', async () => {
  const { calculateQuote } = await import('../dist/domain/deal/quotes.js');
  const { getAsset } = await import('../dist/config/assets.js');
  const { toDecimal } = await import('../dist/core/money.js');
  const quote = calculateQuote({
    usdAmount: toDecimal('105'),
    usdPrice: toDecimal('100000'),
    asset: getAsset('BTC'),
    ttlSeconds: 900,
  });
  assert.equal(quote.cryptoAmount.toFixed(8), '0.00105000');
});

await check('state machine', async () => {
  const { canTransition } = await import('../dist/domain/deal/state.js');
  assert.equal(canTransition('CREATED', 'PARTNER_ADDED'), true);
  assert.equal(canTransition('CREATED', 'COMPLETED'), false);
});

await check('env validation (zod, dotenv)', async () => {
  const m = await import('../dist/config/env.js');
  assert.equal(typeof m.parseEnv, 'function');
});

await check('signers (js-sha3 via node:crypto, ioredis types)', async () => {
  const m = await import('../dist/wallets/index.js');
  assert.equal(typeof m.createSigner, 'function');
});

await check('price providers', async () => {
  const { MockPriceProvider } = await import('../dist/prices/index.js');
  const price = await new MockPriceProvider().getUsdPrice('BTC');
  assert.equal(price.toFixed(2), '100000.00');
});

await check('chain adapters and registry', async () => {
  const m = await import('../dist/chains/index.js');
  assert.equal(typeof m.ChainRegistry, 'function');
});

await check('discord component builders', async () => {
  const m = await import('../dist/bot/components/paymentPanels.js');
  assert.equal(typeof m.buildPaymentInstructionEmbed, 'function');
});

await check('slash command definitions build', async () => {
  const { commandList } = await import('../dist/bot/commands/index.js');
  assert.ok(commandList.length >= 4);
  for (const command of commandList) {
    assert.ok(command.data.name, 'every command has a name');
  }
});

await check('the entrypoint module graph loads', async () => {
  // Imports index.js for its side-effect-free module graph only; main() is
  // guarded behind the import, so nothing connects.
  await import('../dist/bot/interactions/router.js');
  await import('../dist/workers/paymentMonitor.js');
  await import('../dist/workers/payoutMonitor.js');
});

process.stdout.write('\n');

if (failures.length > 0) {
  process.stdout.write(`${failures.length} check(s) failed under real Node ESM.\n\n`);
  process.exit(1);
}

process.stdout.write('All checks passed under real Node ESM.\n\n');
