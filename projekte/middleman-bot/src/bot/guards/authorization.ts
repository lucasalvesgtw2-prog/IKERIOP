import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { ForbiddenError } from '../../core/errors.js';
import { type ResolvedGuildConfig } from '../../services/configService.js';

/**
 * Server-side authorization.
 *
 * Role membership is read from the live guild member on every check — never
 * from a cached copy on the deal, and never from anything the client sent.
 * Losing a role therefore takes effect on the very next interaction.
 */

export type StaffLevel = 'support' | 'middleman' | 'admin';

/** Minimal shape a staff check needs; keeps the guard unit-testable. */
export interface MemberLike {
  id: string;
  roles: { cache: { has(roleId: string): boolean } };
  permissions: { has(permission: bigint): boolean };
}

export function toMemberLike(member: GuildMember): MemberLike {
  return member;
}

/**
 * A Discord server administrator is always treated as bot-admin: they can
 * grant themselves any role anyway, so pretending otherwise adds no security.
 */
function isGuildAdministrator(member: MemberLike): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export function hasRole(member: MemberLike, roleId: string | undefined): boolean {
  return roleId !== undefined && member.roles.cache.has(roleId);
}

export function isAdmin(member: MemberLike, config: ResolvedGuildConfig): boolean {
  return isGuildAdministrator(member) || hasRole(member, config.adminRoleId);
}

export function isMiddleman(member: MemberLike, config: ResolvedGuildConfig): boolean {
  return isAdmin(member, config) || hasRole(member, config.middlemanRoleId);
}

export function isSupport(member: MemberLike, config: ResolvedGuildConfig): boolean {
  return isMiddleman(member, config) || hasRole(member, config.supportRoleId);
}

/** True for any level of staff. Used for read access to tickets. */
export function isStaff(member: MemberLike, config: ResolvedGuildConfig): boolean {
  return isSupport(member, config);
}

export function hasStaffLevel(
  member: MemberLike,
  config: ResolvedGuildConfig,
  level: StaffLevel,
): boolean {
  switch (level) {
    case 'support':
      return isSupport(member, config);
    case 'middleman':
      return isMiddleman(member, config);
    case 'admin':
      return isAdmin(member, config);
  }
}

const LEVEL_LABELS: Record<StaffLevel, string> = {
  support: 'Support',
  middleman: 'Middleman',
  admin: 'Admin',
};

export function requireStaffLevel(
  member: MemberLike,
  config: ResolvedGuildConfig,
  level: StaffLevel,
): void {
  if (!hasStaffLevel(member, config, level)) {
    throw new ForbiddenError(
      `Actor ${member.id} lacks staff level ${level}`,
      `This action requires the ${LEVEL_LABELS[level]} role.`,
      { level },
    );
  }
}

/**
 * Deal-level participant checks.
 *
 * `deal` is always the row loaded from the database inside the current
 * request — never a value reconstructed from the interaction payload.
 */
export interface DealActors {
  creatorDiscordId: string;
  buyerDiscordId: string | null;
  sellerDiscordId: string | null;
}

export function isBuyer(deal: DealActors, discordId: string): boolean {
  return deal.buyerDiscordId !== null && deal.buyerDiscordId === discordId;
}

export function isSeller(deal: DealActors, discordId: string): boolean {
  return deal.sellerDiscordId !== null && deal.sellerDiscordId === discordId;
}

export function isCreator(deal: DealActors, discordId: string): boolean {
  return deal.creatorDiscordId === discordId;
}

export function isParticipant(deal: DealActors, discordId: string): boolean {
  return isCreator(deal, discordId) || isBuyer(deal, discordId) || isSeller(deal, discordId);
}

export function requireParticipant(deal: DealActors, discordId: string): void {
  if (!isParticipant(deal, discordId)) {
    throw new ForbiddenError(
      `Actor ${discordId} is not a participant of the deal`,
      'You are not a participant in this deal.',
    );
  }
}

export function requireBuyer(deal: DealActors, discordId: string): void {
  if (!isBuyer(deal, discordId)) {
    throw new ForbiddenError(
      `Actor ${discordId} is not the buyer`,
      'Only the **Buyer** can use this action.',
    );
  }
}

export function requireSeller(deal: DealActors, discordId: string): void {
  if (!isSeller(deal, discordId)) {
    throw new ForbiddenError(
      `Actor ${discordId} is not the seller`,
      'Only the **Seller** can use this action.',
    );
  }
}

export function requireCreator(deal: DealActors, discordId: string): void {
  if (!isCreator(deal, discordId)) {
    throw new ForbiddenError(
      `Actor ${discordId} is not the ticket creator`,
      'Only the person who opened this ticket can use this action.',
    );
  }
}
