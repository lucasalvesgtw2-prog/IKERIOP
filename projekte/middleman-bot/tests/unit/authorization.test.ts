import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { ForbiddenError } from '../../src/core/errors.js';
import { Decimal } from '../../src/core/money.js';
import {
  isAdmin,
  isBuyer,
  isMiddleman,
  isParticipant,
  isSeller,
  isStaff,
  requireBuyer,
  requireCreator,
  requireParticipant,
  requireSeller,
  requireStaffLevel,
  type MemberLike,
} from '../../src/bot/guards/authorization.js';
import { type ResolvedGuildConfig } from '../../src/services/configService.js';

const CONFIG: ResolvedGuildConfig = {
  guildId: 'g1',
  supportRoleId: 'role-support',
  middlemanRoleId: 'role-middleman',
  adminRoleId: 'role-admin',
  feePercentage: new Decimal('5'),
  minDealAmountUsd: new Decimal('5'),
  maxDealAmountUsd: new Decimal('100000'),
  enabledAssets: ['BTC'],
  ticketCloseDelaySeconds: 300,
};

function member(options: { id?: string; roles?: string[]; administrator?: boolean }): MemberLike {
  const roles = new Set(options.roles ?? []);
  return {
    id: options.id ?? 'u1',
    roles: { cache: { has: (roleId: string) => roles.has(roleId) } },
    permissions: {
      has: (permission: bigint) =>
        permission === PermissionFlagsBits.Administrator && options.administrator === true,
    },
  };
}

describe('staff levels', () => {
  it('treats an ordinary member as nothing', () => {
    const user = member({});
    expect(isStaff(user, CONFIG)).toBe(false);
    expect(isMiddleman(user, CONFIG)).toBe(false);
    expect(isAdmin(user, CONFIG)).toBe(false);
  });

  it('escalates support < middleman < admin', () => {
    const support = member({ roles: ['role-support'] });
    expect(isStaff(support, CONFIG)).toBe(true);
    expect(isMiddleman(support, CONFIG)).toBe(false);
    expect(isAdmin(support, CONFIG)).toBe(false);

    const middleman = member({ roles: ['role-middleman'] });
    expect(isStaff(middleman, CONFIG)).toBe(true);
    expect(isMiddleman(middleman, CONFIG)).toBe(true);
    expect(isAdmin(middleman, CONFIG)).toBe(false);

    const admin = member({ roles: ['role-admin'] });
    expect(isStaff(admin, CONFIG)).toBe(true);
    expect(isMiddleman(admin, CONFIG)).toBe(true);
    expect(isAdmin(admin, CONFIG)).toBe(true);
  });

  it('treats a Discord server administrator as bot admin', () => {
    const user = member({ administrator: true });
    expect(isAdmin(user, CONFIG)).toBe(true);
    expect(isStaff(user, CONFIG)).toBe(true);
  });

  it('does not grant staff from an unrelated role', () => {
    expect(isStaff(member({ roles: ['role-vip', 'role-booster'] }), CONFIG)).toBe(false);
  });

  it('grants nothing when the role is not configured', () => {
    const withoutRoles: ResolvedGuildConfig = { ...CONFIG };
    delete (withoutRoles as { supportRoleId?: string }).supportRoleId;
    delete (withoutRoles as { middlemanRoleId?: string }).middlemanRoleId;
    delete (withoutRoles as { adminRoleId?: string }).adminRoleId;

    // A member carrying a role id that simply is not configured gets nothing.
    expect(isStaff(member({ roles: ['role-support'] }), withoutRoles)).toBe(false);
  });

  it('throws a user-safe error when the level is missing', () => {
    expect(() => requireStaffLevel(member({}), CONFIG, 'admin')).toThrow(ForbiddenError);

    try {
      requireStaffLevel(member({ roles: ['role-support'] }), CONFIG, 'admin');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).userMessage).toContain('Admin');
      // The internal message must not leak into the user-facing text.
      expect((error as ForbiddenError).userMessage).not.toContain('lacks staff level');
    }
  });

  it('lets a support member pass a support check but not an admin check', () => {
    const support = member({ roles: ['role-support'] });
    expect(() => requireStaffLevel(support, CONFIG, 'support')).not.toThrow();
    expect(() => requireStaffLevel(support, CONFIG, 'middleman')).toThrow(ForbiddenError);
  });
});

describe('deal participants', () => {
  const deal = {
    creatorDiscordId: 'creator',
    buyerDiscordId: 'creator',
    sellerDiscordId: 'seller',
  };

  it('identifies each role', () => {
    expect(isBuyer(deal, 'creator')).toBe(true);
    expect(isSeller(deal, 'seller')).toBe(true);
    expect(isBuyer(deal, 'seller')).toBe(false);
    expect(isSeller(deal, 'creator')).toBe(false);
  });

  it('treats a stranger as no one', () => {
    expect(isParticipant(deal, 'stranger')).toBe(false);
    expect(() => requireParticipant(deal, 'stranger')).toThrow(ForbiddenError);
  });

  it('never matches an unassigned role against a null id', () => {
    const unassigned = { creatorDiscordId: 'creator', buyerDiscordId: null, sellerDiscordId: null };
    expect(isBuyer(unassigned, 'creator')).toBe(false);
    expect(isSeller(unassigned, 'creator')).toBe(false);
    // A null id must not be matchable by a user whose id is somehow falsy.
    expect(isBuyer(unassigned, '')).toBe(false);
    expect(isSeller(unassigned, '')).toBe(false);
  });

  it('enforces buyer-only and seller-only actions', () => {
    expect(() => requireBuyer(deal, 'creator')).not.toThrow();
    expect(() => requireBuyer(deal, 'seller')).toThrow(ForbiddenError);
    expect(() => requireSeller(deal, 'seller')).not.toThrow();
    expect(() => requireSeller(deal, 'creator')).toThrow(ForbiddenError);
    expect(() => requireCreator(deal, 'creator')).not.toThrow();
    expect(() => requireCreator(deal, 'seller')).toThrow(ForbiddenError);
  });
});
