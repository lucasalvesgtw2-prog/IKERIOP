import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import { DETAIL_LIMITS, type RawDealDetails } from '../../services/dealDetailsService.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

/**
 * Modals for the deal details and for a change request.
 *
 * The `maxLength` values here are a client-side convenience only. Discord does
 * not guarantee them, so `DealDetailsService.validate` re-checks every field.
 */

export const DETAIL_FIELD_IDS = {
  item: 'item',
  description: 'description',
  additionalTerms: 'terms',
  dealAmount: 'amount',
} as const;

export const CHANGE_REASON_FIELD_ID = 'reason';

/** Values used to pre-fill the modal when the seller is revising. */
export interface DealDetailsPrefill {
  item?: string | null;
  description?: string | null;
  additionalTerms?: string | null;
  dealAmountUsd?: string | null;
}

export function buildDealDetailsModal(params: {
  publicDealId: string;
  nonce: string;
  prefill?: DealDetailsPrefill;
  revising: boolean;
}): ModalBuilder {
  const prefill = params.prefill ?? {};

  const modal = new ModalBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: 'detailsmodal',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    // Discord caps a modal title at 45 characters.
    .setTitle(
      params.revising ? `Update deal ${params.publicDealId}` : `Deal ${params.publicDealId}`,
    );

  const item = new TextInputBuilder()
    .setCustomId(DETAIL_FIELD_IDS.item)
    .setLabel('Item / Service')
    .setPlaceholder('e.g. Steam Account')
    .setStyle(TextInputStyle.Short)
    .setMinLength(DETAIL_LIMITS.item.min)
    .setMaxLength(DETAIL_LIMITS.item.max)
    .setRequired(true);

  const description = new TextInputBuilder()
    .setCustomId(DETAIL_FIELD_IDS.description)
    .setLabel('Description')
    .setPlaceholder('e.g. Level 50 gaming account with the listed items.')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(DETAIL_LIMITS.description.min)
    .setMaxLength(DETAIL_LIMITS.description.max)
    .setRequired(true);

  const terms = new TextInputBuilder()
    .setCustomId(DETAIL_FIELD_IDS.additionalTerms)
    .setLabel('Additional Terms (optional)')
    .setPlaceholder('e.g. Login details are provided after the payment is confirmed.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(DETAIL_LIMITS.additionalTerms.max)
    .setRequired(false);

  // The label states the unit, because this is the single field where a
  // misunderstanding costs money.
  const amount = new TextInputBuilder()
    .setCustomId(DETAIL_FIELD_IDS.dealAmount)
    .setLabel('Deal Amount in USD (e.g. 100)')
    .setPlaceholder('100')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(20)
    .setRequired(true);

  applyPrefill(item, prefill.item);
  applyPrefill(description, prefill.description);
  applyPrefill(terms, prefill.additionalTerms);
  applyPrefill(amount, prefill.dealAmountUsd);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(item),
    new ActionRowBuilder<TextInputBuilder>().addComponents(description),
    new ActionRowBuilder<TextInputBuilder>().addComponents(terms),
    new ActionRowBuilder<TextInputBuilder>().addComponents(amount),
  );

  return modal;
}

export function buildChangeRequestModal(params: {
  publicDealId: string;
  nonce: string;
}): ModalBuilder {
  const reason = new TextInputBuilder()
    .setCustomId(CHANGE_REASON_FIELD_ID)
    .setLabel('What needs to be changed?')
    .setPlaceholder('e.g. The price is too high, and the description is missing the item list.')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(DETAIL_LIMITS.changeRequest.min)
    .setMaxLength(DETAIL_LIMITS.changeRequest.max)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: 'changesmodal',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    .setTitle(`Request changes — ${params.publicDealId}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
}

/** Reads the four detail fields out of a submitted modal. */
export function readDealDetailsSubmission(interaction: ModalSubmitInteraction): RawDealDetails {
  return {
    item: interaction.fields.getTextInputValue(DETAIL_FIELD_IDS.item),
    description: interaction.fields.getTextInputValue(DETAIL_FIELD_IDS.description),
    additionalTerms: readOptionalField(interaction, DETAIL_FIELD_IDS.additionalTerms),
    dealAmount: interaction.fields.getTextInputValue(DETAIL_FIELD_IDS.dealAmount),
  };
}

export function readChangeReason(interaction: ModalSubmitInteraction): string {
  return interaction.fields.getTextInputValue(CHANGE_REASON_FIELD_ID);
}

/**
 * An optional field that the user left blank may be absent from the payload
 * entirely, which makes `getTextInputValue` throw.
 */
function readOptionalField(interaction: ModalSubmitInteraction, fieldId: string): string {
  try {
    return interaction.fields.getTextInputValue(fieldId);
  } catch {
    return '';
  }
}

/** Discord rejects an empty `value`, so only a non-empty prefill is applied. */
function applyPrefill(input: TextInputBuilder, value: string | null | undefined): void {
  if (value && value.length > 0) {
    input.setValue(value);
  }
}
