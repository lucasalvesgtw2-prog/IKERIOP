import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { ConfigurationError, ValidationError } from '../../core/errors.js';
import { formatUsd, toDecimal } from '../../core/money.js';
import { assertValidFeePercentage } from '../../domain/deal/fees.js';
import { getEnv } from '../../config/env.js';
import { ASSETS, resolvePair } from '../../config/assets.js';
import { DEAL_STATE_LABELS, type DealState } from '../../domain/deal/state.js';
import { requireStaffLevel } from '../guards/authorization.js';
import { COLORS } from '../components/colors.js';
import { replyPrivate } from '../interactions/respond.js';
import { type InteractionContext } from '../interactions/context.js';
import { type BotCommand } from './types.js';

/**
 * Admin and support commands.
 *
 * Every subcommand re-checks the caller's role server-side. Discord's
 * `default_member_permissions` only hides the command; it is not an
 * authorisation mechanism.
 */
const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Administration and support tools for the middleman service.')
  .addSubcommandGroup((group) =>
    group
      .setName('config')
      .setDescription('Configure the service.')
      .addSubcommand((sub) =>
        sub.setName('show').setDescription('Show the effective configuration.'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('fee')
          .setDescription('Set the middleman fee percentage for new deals.')
          .addStringOption((option) =>
            option.setName('percentage').setDescription('For example: 5').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('roles')
          .setDescription('Set the support, middleman and admin roles.')
          .addRoleOption((o) => o.setName('support').setDescription('Support role'))
          .addRoleOption((o) => o.setName('middleman').setDescription('Middleman role'))
          .addRoleOption((o) => o.setName('admin').setDescription('Admin role')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('limits')
          .setDescription('Set the minimum and maximum deal amount in USD.')
          .addStringOption((o) => o.setName('min').setDescription('Minimum in USD'))
          .addStringOption((o) => o.setName('max').setDescription('Maximum in USD')),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('wallet')
      .setDescription('Manage deposit and treasury addresses.')
      .addSubcommand((sub) => sub.setName('list').setDescription('List the configured wallets.'))
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Register a wallet address.')
          .addStringOption((o) =>
            o
              .setName('kind')
              .setDescription('What the address is for')
              .setRequired(true)
              .addChoices(
                { name: 'Deposit (receives buyer payments)', value: 'DEPOSIT' },
                { name: 'Treasury (sends payouts)', value: 'TREASURY' },
              ),
          )
          .addStringOption((o) => o.setName('asset').setDescription('e.g. BTC').setRequired(true))
          .addStringOption((o) =>
            o.setName('network').setDescription('e.g. bitcoin').setRequired(true),
          )
          .addStringOption((o) =>
            o.setName('address').setDescription('The address').setRequired(true),
          )
          .addStringOption((o) => o.setName('label').setDescription('Optional label')),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('dispute')
      .setDescription('Handle disputes.')
      .addSubcommand((sub) => sub.setName('list').setDescription('List open disputes.'))
      .addSubcommand((sub) =>
        sub.setName('claim').setDescription('Claim the dispute in this ticket.'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('resolve')
          .setDescription('Resolve the dispute in this ticket.')
          .addStringOption((o) =>
            o
              .setName('outcome')
              .setDescription('What was decided')
              .setRequired(true)
              .addChoices(
                { name: 'Release the funds to the seller', value: 'RESOLVED_RELEASE_TO_SELLER' },
                { name: 'Refund the buyer (handled by staff)', value: 'RESOLVED_REFUND_TO_BUYER' },
                { name: 'Other / by agreement', value: 'RESOLVED_OTHER' },
              ),
          )
          .addStringOption((o) =>
            o.setName('note').setDescription('What was decided and why').setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('deal')
      .setDescription('Inspect and annotate deals.')
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('List deals that need attention.')
          .addStringOption((o) => o.setName('status').setDescription('Filter by status')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('note')
          .setDescription('Add a support note to the deal in this ticket.')
          .addStringOption((o) => o.setName('note').setDescription('The note').setRequired(true)),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('payout')
      .setDescription('Payout operations.')
      .addSubcommand((sub) =>
        sub
          .setName('sent')
          .setDescription('Record a payout you broadcast manually.')
          .addStringOption((o) =>
            o.setName('txhash').setDescription('The transaction hash').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('reconcile').setDescription('Re-check every in-flight payout at the signer.'),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const adminCommand: BotCommand = {
  name: 'admin',
  data: data.toJSON(),

  async execute(interaction: ChatInputCommandInteraction, ctx: InteractionContext): Promise<void> {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    switch (group) {
      case 'config':
        return handleConfig(interaction, ctx, sub);
      case 'wallet':
        return handleWallet(interaction, ctx, sub);
      case 'dispute':
        return handleDispute(interaction, ctx, sub);
      case 'deal':
        return handleDeal(interaction, ctx, sub);
      case 'payout':
        return handlePayout(interaction, ctx, sub);
      default:
        await replyPrivate(interaction, { content: 'Unknown command.' });
    }
  },
};

async function handleConfig(
  interaction: ChatInputCommandInteraction,
  ctx: InteractionContext,
  sub: string,
): Promise<void> {
  if (sub === 'show') {
    // Reading configuration is a support-level action; changing it is not.
    requireStaffLevel(ctx.member, ctx.guildConfig, 'support');

    const env = getEnv();
    const config = ctx.guildConfig;

    await replyPrivate(interaction, {
      embeds: [
        {
          color: COLORS.info,
          title: 'Effective configuration',
          fields: [
            { name: 'Fee', value: `${config.feePercentage.toString()}%`, inline: true },
            {
              name: 'Deal limits',
              value: `${formatUsd(config.minDealAmountUsd)} – ${formatUsd(config.maxDealAmountUsd)}`,
              inline: true,
            },
            {
              name: 'Enabled assets',
              value: config.enabledAssets.join(', ') || 'none',
              inline: true,
            },
            { name: 'Support role', value: roleMention(config.supportRoleId), inline: true },
            { name: 'Middleman role', value: roleMention(config.middlemanRoleId), inline: true },
            { name: 'Admin role', value: roleMention(config.adminRoleId), inline: true },
            {
              name: 'Runtime',
              value: [
                `LIVE_MODE: **${env.LIVE_MODE ? 'ON — real funds' : 'off — simulated'}**`,
                `Chain mode: \`${env.CHAIN_NETWORK_MODE}\``,
                `Price provider: \`${ctx.bot.prices.name}\`${ctx.bot.prices.isMock ? ' (mock)' : ''}`,
                `Signer: \`${ctx.bot.signer.name}\`${ctx.bot.signer.isMock ? ' (mock)' : ''}`,
              ].join('\n'),
            },
          ],
        },
      ],
    });
    return;
  }

  requireStaffLevel(ctx.member, ctx.guildConfig, 'admin');

  if (sub === 'fee') {
    const raw = interaction.options.getString('percentage', true);
    const percentage = assertValidFeePercentage(raw);

    await upsertConfig(ctx, { feePercentage: percentage.toString() });

    await replyPrivate(interaction, {
      content: `✅ The middleman fee for **new** deals is now **${percentage.toString()}%**. Deals already in progress keep the fee they were created with.`,
    });
    return;
  }

  if (sub === 'roles') {
    const support = interaction.options.getRole('support');
    const middleman = interaction.options.getRole('middleman');
    const admin = interaction.options.getRole('admin');

    await upsertConfig(ctx, {
      ...(support ? { supportRoleId: support.id } : {}),
      ...(middleman ? { middlemanRoleId: middleman.id } : {}),
      ...(admin ? { adminRoleId: admin.id } : {}),
    });

    await replyPrivate(interaction, { content: '✅ Roles updated.' });
    return;
  }

  if (sub === 'limits') {
    const min = interaction.options.getString('min');
    const max = interaction.options.getString('max');

    const data: Record<string, string> = {};
    if (min) data.minDealAmountUsd = toDecimal(min).toFixed(2);
    if (max) data.maxDealAmountUsd = toDecimal(max).toFixed(2);

    if (Object.keys(data).length === 0) {
      throw new ValidationError('No limits given', 'Provide a minimum, a maximum, or both.');
    }

    await upsertConfig(ctx, data);
    await replyPrivate(interaction, { content: '✅ Deal limits updated.' });
  }
}

async function handleWallet(
  interaction: ChatInputCommandInteraction,
  ctx: InteractionContext,
  sub: string,
): Promise<void> {
  requireStaffLevel(ctx.member, ctx.guildConfig, 'admin');

  if (sub === 'list') {
    const wallets = await ctx.bot.wallets.list();

    await replyPrivate(interaction, {
      content: wallets.length
        ? wallets
            .map(
              (w) =>
                `\`${w.kind}\` **${w.asset}** on \`${w.network}\` — \`${w.address}\`${w.inUse ? ' *(in use)*' : ''}${w.active ? '' : ' *(inactive)*'}`,
            )
            .join('\n')
        : 'No wallets are configured. Add one with `/admin wallet add`.',
    });
    return;
  }

  const kind = interaction.options.getString('kind', true) as 'DEPOSIT' | 'TREASURY';
  const asset = interaction.options.getString('asset', true).toUpperCase();
  const network = interaction.options.getString('network', true).toLowerCase();
  const address = interaction.options.getString('address', true).trim();
  const label = interaction.options.getString('label');

  const pair = resolvePair(asset, network);

  if (!pair) {
    throw new ValidationError(
      `Invalid asset/network pair ${asset}/${network}`,
      `\`${asset}\` on \`${network}\` is not a supported combination. Supported assets: ${Object.keys(ASSETS).join(', ')}.`,
    );
  }

  // Validated by the chain adapter, so an address for the wrong network can
  // never enter the pool and be handed to a buyer.
  const adapter = ctx.bot.chains.get(pair.network.id);
  const result = adapter.validateAddress(address, pair.asset.symbol);

  if (!result.valid || !result.normalized) {
    throw new ValidationError(
      `Invalid ${asset} address for ${network}`,
      `❌ That is not a valid **${pair.asset.symbol}** address for **${pair.network.label}**.\n\n${result.reason ?? ''}`,
    );
  }

  const wallet = await ctx.bot.wallets.add({
    kind,
    asset: pair.asset.symbol,
    network: pair.network.id,
    address: result.normalized,
    ...(label ? { label } : {}),
  });

  await replyPrivate(interaction, {
    content: `✅ Registered a ${kind.toLowerCase()} wallet: **${wallet.asset}** on **${pair.network.label}** — \`${wallet.address}\``,
  });
}

async function handleDispute(
  interaction: ChatInputCommandInteraction,
  ctx: InteractionContext,
  sub: string,
): Promise<void> {
  requireStaffLevel(ctx.member, ctx.guildConfig, 'support');

  if (sub === 'list') {
    const disputes = await ctx.bot.disputes.listOpen();

    await replyPrivate(interaction, {
      content: disputes.length
        ? disputes
            .map(
              (d) => `\`${d.status}\` deal \`${d.dealId}\` — opened by <@${d.openedByDiscordId}>`,
            )
            .join('\n')
        : 'There are no open disputes.',
    });
    return;
  }

  const ticket = await ctx.bot.tickets.requireByChannelId(interaction.channelId);

  if (sub === 'claim') {
    await ctx.bot.disputes.claim({
      dealId: ticket.deal.id,
      staffDiscordId: interaction.user.id,
    });

    await replyPrivate(interaction, { content: '✅ You have claimed this dispute.' });
    return;
  }

  if (sub === 'resolve') {
    const outcome = interaction.options.getString('outcome', true) as
      'RESOLVED_RELEASE_TO_SELLER' | 'RESOLVED_REFUND_TO_BUYER' | 'RESOLVED_OTHER';
    const note = interaction.options.getString('note', true);

    const deal = await ctx.bot.deals.requireById(ticket.deal.id);

    const resolved = await ctx.bot.disputes.resolve({
      deal,
      staffDiscordId: interaction.user.id,
      resolution: outcome,
      note,
      correlationId: ctx.correlationId,
    });

    const { buildDisputeResolvedEmbed } = await import('../components/disputePanels.js');

    if (interaction.channel?.isSendable()) {
      await interaction.channel.send({
        embeds: [
          buildDisputeResolvedEmbed({
            publicDealId: resolved.publicId,
            staffDiscordId: interaction.user.id,
            resolution: outcome,
            note,
            movedTo: resolved.status,
          }),
        ],
      });
    }

    await replyPrivate(interaction, {
      content: `✅ Dispute resolved. The deal is now \`${resolved.status}\`.`,
    });
  }
}

async function handleDeal(
  interaction: ChatInputCommandInteraction,
  ctx: InteractionContext,
  sub: string,
): Promise<void> {
  requireStaffLevel(ctx.member, ctx.guildConfig, 'support');

  if (sub === 'list') {
    const status = interaction.options.getString('status');

    const deals = await ctx.bot.prisma.deal.findMany({
      where: {
        guildId: ctx.guild.id,
        ...(status ? { status: status as never } : { status: { in: ATTENTION_STATES as never } }),
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    await replyPrivate(interaction, {
      content: deals.length
        ? deals
            .map(
              (d) =>
                `\`${d.publicId}\` — ${DEAL_STATE_LABELS[d.status as DealState] ?? d.status}${
                  d.dealAmountUsd ? ` — ${formatUsd(toDecimal(String(d.dealAmountUsd)))}` : ''
                }`,
            )
            .join('\n')
        : 'No deals match.',
    });
    return;
  }

  if (sub === 'note') {
    const ticket = await ctx.bot.tickets.requireByChannelId(interaction.channelId);

    await ctx.bot.disputes.addNote({
      dealId: ticket.deal.id,
      staffDiscordId: interaction.user.id,
      note: interaction.options.getString('note', true),
    });

    await replyPrivate(interaction, { content: '✅ Note added to the deal record.' });
  }
}

/** States that usually need a human to look at them. */
const ATTENTION_STATES = [
  'DISPUTED',
  'PAYOUT_REVIEW',
  'PAYOUT_REVIEW_REQUIRED',
  'PAYOUT_PENDING',
  'PAYOUT_BROADCAST',
  'FAILED',
];

async function handlePayout(
  interaction: ChatInputCommandInteraction,
  ctx: InteractionContext,
  sub: string,
): Promise<void> {
  requireStaffLevel(ctx.member, ctx.guildConfig, 'middleman');

  if (sub === 'reconcile') {
    const result = await ctx.bot.payouts.reconcile();

    await replyPrivate(interaction, {
      content: `✅ Reconciliation complete. Checked ${result.checked} in-flight payout(s), recovered ${result.recovered}.`,
    });
    return;
  }

  if (sub !== 'sent') return;

  const txHash = interaction.options.getString('txhash', true).trim();
  const ticket = await ctx.bot.tickets.requireByChannelId(interaction.channelId);
  const deal = await ctx.bot.deals.requireById(ticket.deal.id);
  const payout = await ctx.bot.payouts.findByDeal(deal.id);

  if (!payout) {
    throw new ValidationError(
      `Deal ${deal.id} has no payout`,
      'There is no prepared payout for this deal.',
    );
  }

  const { ManualSigner } = await import('../../wallets/manualSigner.js');

  if (!(ctx.bot.signer instanceof ManualSigner)) {
    throw new ConfigurationError('Manual payout recording requires SIGNER_BACKEND=manual', {
      signer: ctx.bot.signer.name,
    });
  }

  // Refuses to replace a hash that is already recorded, so a second
  // transaction cannot be attached to one payout.
  await ctx.bot.signer.recordBroadcast(payout.idempotencyKey, txHash);

  const result = await ctx.bot.payouts.recordBroadcast({
    deal,
    payout,
    txHash,
    deduplicated: false,
    networkFee: null,
    actorDiscordId: interaction.user.id,
    correlationId: ctx.correlationId,
  });

  await replyPrivate(interaction, {
    content: `✅ Recorded. The bot will now verify \`${result.txHash}\` on the blockchain and track its confirmations.`,
  });
}

async function upsertConfig(ctx: InteractionContext, data: Record<string, string>): Promise<void> {
  await ctx.bot.prisma.guildConfig.upsert({
    where: { guildId: ctx.guild.id },
    update: data,
    create: { guildId: ctx.guild.id, ...data },
  });

  // Cleared immediately so the person who made the change sees it take effect.
  ctx.bot.config.invalidate(ctx.guild.id);

  await ctx.bot.prisma.supportAction.create({
    data: {
      actorDiscordId: ctx.member.id,
      type: 'CONFIG_CHANGED',
      metadata: data,
    },
  });
}

function roleMention(roleId: string | undefined): string {
  return roleId ? `<@&${roleId}>` : '*not configured*';
}
