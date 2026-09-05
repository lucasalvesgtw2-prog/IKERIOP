import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { availableAssets, networksForAsset, type NetworkDefinition } from '../../config/assets.js';
import { formatUsd, type Decimal } from '../../core/money.js';
import { encodePair } from '../../services/currencyService.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

/**
 * Currency selection.
 *
 * One menu lists complete (asset, network) pairs. Asking for an asset and then
 * a network would create a half-chosen state and a way for the two to arrive
 * mismatched; a single list cannot express a combination that does not exist.
 */
export type CurrencyRole = 'buyer' | 'seller';

export function buildCurrencySelect(params: {
  role: CurrencyRole;
  publicDealId: string;
  nonce: string;
  enabledAssets: string[];
  mode: 'mock' | 'testnet' | 'mainnet';
}): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const isBuyer = params.role === 'buyer';

  const embed = new EmbedBuilder()
    .setColor(COLORS.money)
    .setTitle(isBuyer ? '💰 Payment Method' : '💰 Receiving Currency')
    .setDescription(
      isBuyer
        ? [
            'Which cryptocurrency would you like to use to pay?',
            '',
            'The deal value stays in **US Dollars** — the cryptocurrency is only how you send the money.',
            'The exact amount is calculated at the current market rate once both sides have chosen.',
          ].join('\n')
        : [
            'Which cryptocurrency would you like to receive?',
            '',
            'You can choose a different cryptocurrency from the one the buyer pays with.',
            'You will receive the full deal value in US Dollar terms.',
          ].join('\n'),
    )
    .setFooter({
      text: isBuyer
        ? 'Only the Buyer can choose the payment currency.'
        : 'Only the Seller can choose the receiving currency.',
    });

  const options = buildPairOptions(params.enabledAssets, params.mode);

  if (options.length === 0) {
    embed.addFields({
      name: '⚠️ No currencies available',
      value:
        'No cryptocurrencies are enabled for the current mode. Please contact an administrator.',
    });
    return { embeds: [embed], components: [] };
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: isBuyer ? 'paycur' : 'recvcur',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    .setPlaceholder(isBuyer ? 'Choose how you want to pay' : 'Choose how you want to be paid')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

/**
 * One option per usable (asset, network) pair.
 *
 * Only networks matching the runtime mode are listed, so a development
 * deployment cannot offer a mainnet rail. Discord caps a menu at 25 options.
 */
function buildPairOptions(
  enabledAssets: string[],
  mode: 'mock' | 'testnet' | 'mainnet',
): StringSelectMenuOptionBuilder[] {
  const options: StringSelectMenuOptionBuilder[] = [];
  const enabled = new Set(enabledAssets);

  for (const asset of availableAssets(mode)) {
    if (!enabled.has(asset.symbol)) continue;

    for (const network of networksForAsset(asset.symbol, mode)) {
      if (options.length >= 25) return options;

      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${asset.symbol} — ${network.label}`)
          .setValue(encodePair(asset.symbol, network.id))
          .setDescription(describePair(asset.name, network)),
      );
    }
  }

  return options;
}

function describePair(assetName: string, network: NetworkDefinition): string {
  const suffix = network.testnet ? ' (testnet — no real funds)' : '';
  return `${assetName} on ${network.label}${suffix}`.slice(0, 100);
}

/** Confirms one side's choice and says who the bot is waiting for. */
export function buildCurrencyChosenNotice(params: {
  role: CurrencyRole;
  actorDiscordId: string;
  assetSymbol: string;
  networkLabel: string;
  waitingForDiscordId: string | null;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(
      params.role === 'buyer' ? '💰 Payment currency selected' : '💰 Receiving currency selected',
    )
    .setDescription(
      [
        `<@${params.actorDiscordId}> will ${params.role === 'buyer' ? 'pay with' : 'receive'} **${params.assetSymbol}** on **${params.networkLabel}**.`,
        params.waitingForDiscordId
          ? `\nWaiting for <@${params.waitingForDiscordId}> to choose their currency.`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

  return embed;
}

/**
 * The USD calculation, shown before any address is generated.
 *
 * Deal Value, Middleman Fee, Buyer Total and the crypto amount are kept
 * visually distinct: the buyer must never be able to confuse "what the deal is
 * worth" with "what I have to send".
 */
export interface PaymentBreakdown {
  publicDealId: string;
  dealAmountUsd: Decimal;
  feeUsd: Decimal;
  feePercentage: Decimal;
  buyerTotalUsd: Decimal;
  buyerAsset: string;
  buyerNetworkLabel: string;
  sellerAsset: string;
  sellerNetworkLabel: string;
}

export function buildPaymentBreakdownEmbed(data: PaymentBreakdown): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.money)
    .setTitle(`${RULE}\n         PAYMENT\n${RULE}`)
    .addFields(
      { name: 'Deal ID', value: `\`${data.publicDealId}\``, inline: false },
      { name: 'Deal Value', value: `**${formatUsd(data.dealAmountUsd)} USD**`, inline: true },
      {
        name: `Middleman Fee (${data.feePercentage.toDecimalPlaces(4).toString()}%)`,
        value: `${formatUsd(data.feeUsd)} USD`,
        inline: true,
      },
      { name: 'Buyer Total', value: `**${formatUsd(data.buyerTotalUsd)} USD**`, inline: true },
      { name: '​', value: RULE },
      { name: 'Buyer pays with', value: `${data.buyerAsset}`, inline: true },
      { name: 'Network', value: data.buyerNetworkLabel, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Seller receives', value: `${data.sellerAsset}`, inline: true },
      { name: 'Network', value: data.sellerNetworkLabel, inline: true },
      { name: '​', value: '​', inline: true },
    )
    .setFooter({
      text: 'All deal values are in US Dollars. The crypto amount is calculated at the current rate.',
    });
}
