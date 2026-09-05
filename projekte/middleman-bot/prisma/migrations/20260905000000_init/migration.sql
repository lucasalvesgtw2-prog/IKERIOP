-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('CREATED', 'PARTNER_ADDED', 'ROLES_ASSIGNED', 'WAITING_FOR_DEAL_DETAILS', 'WAITING_FOR_BUYER_APPROVAL', 'BUYER_APPROVED', 'CURRENCY_SELECTION', 'PAYMENT_REQUEST_CREATED', 'AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMING', 'PAYMENT_CONFIRMED', 'DEAL_IN_PROGRESS', 'WAITING_FOR_COMPLETION_CONFIRMATIONS', 'BUYER_COMPLETED', 'SELLER_COMPLETED', 'READY_FOR_PAYOUT_ADDRESS', 'PAYOUT_ADDRESS_SUBMITTED', 'PAYOUT_REVIEW', 'PAYOUT_PENDING', 'PAYOUT_BROADCAST', 'PAYOUT_CONFIRMING', 'PAYOUT_CONFIRMED', 'WAITING_FOR_SELLER_RECEIPT', 'PAYOUT_REVIEW_REQUIRED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealRole" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DETECTED', 'CONFIRMING', 'CONFIRMED', 'UNDERPAID', 'OVERPAID', 'WRONG_NETWORK', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'AWAITING_AUTHORIZATION', 'AUTHORIZED', 'SIGNING', 'BROADCAST', 'CONFIRMING', 'CONFIRMED', 'REVIEW_REQUIRED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_RELEASE_TO_SELLER', 'RESOLVED_REFUND_TO_BUYER', 'RESOLVED_OTHER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('DEPOSIT', 'TREASURY');

-- CreateEnum
CREATE TYPE "SupportActionType" AS ENUM ('NOTE_ADDED', 'DEAL_PAUSED', 'DEAL_RESUMED', 'DISPUTE_CLAIMED', 'DISPUTE_RESOLVED', 'PAYOUT_AUTHORIZED', 'PAYOUT_REJECTED', 'PAYOUT_MARKED_SENT', 'DEAL_CANCELLED', 'CONFIG_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "dealsCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closeReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "creatorDiscordId" TEXT NOT NULL,
    "partnerDiscordId" TEXT,
    "buyerDiscordId" TEXT,
    "sellerDiscordId" TEXT,
    "item" TEXT,
    "description" TEXT,
    "additionalTerms" TEXT,
    "dealAmountUsd" DECIMAL(18,2),
    "feePercentage" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "feeUsd" DECIMAL(18,2),
    "buyerTotalUsd" DECIMAL(18,2),
    "sellerPayoutUsd" DECIMAL(18,2),
    "buyerAsset" TEXT,
    "buyerNetwork" TEXT,
    "sellerAsset" TEXT,
    "sellerNetwork" TEXT,
    "paymentCryptoAmount" DECIMAL(38,18),
    "paymentAddress" TEXT,
    "paymentTxHash" TEXT,
    "payoutCryptoAmount" DECIMAL(38,18),
    "payoutAddress" TEXT,
    "payoutTxHash" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'CREATED',
    "buyerApproved" BOOLEAN NOT NULL DEFAULT false,
    "buyerApprovedAt" TIMESTAMP(3),
    "buyerCompleted" BOOLEAN NOT NULL DEFAULT false,
    "buyerCompletedAt" TIMESTAMP(3),
    "sellerCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sellerCompletedAt" TIMESTAMP(3),
    "sellerReceivedFunds" BOOLEAN NOT NULL DEFAULT false,
    "sellerReceivedAt" TIMESTAMP(3),
    "payoutLockedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "summaryMessageId" TEXT,
    "paymentMessageId" TEXT,
    "statusMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_participants" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "role" "DealRole" NOT NULL,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_details" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "additionalTerms" TEXT,
    "dealAmountUsd" DECIMAL(18,2) NOT NULL,
    "submittedByDiscordId" TEXT NOT NULL,
    "changeRequestReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "expectedUsd" DECIMAL(18,2) NOT NULL,
    "expectedCryptoAmount" DECIMAL(38,18) NOT NULL,
    "receivedCryptoAmount" DECIMAL(38,18),
    "toleranceCryptoAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "quoteId" TEXT,
    "depositAddress" TEXT NOT NULL,
    "walletId" TEXT,
    "txHash" TEXT,
    "fromAddress" TEXT,
    "blockHeight" BIGINT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "requiredConfirmations" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "amountUsd" DECIMAL(18,2) NOT NULL,
    "cryptoAmount" DECIMAL(38,18) NOT NULL,
    "networkFeeCrypto" DECIMAL(38,18),
    "networkFeeUsd" DECIMAL(18,2),
    "quoteId" TEXT,
    "destinationAddress" TEXT NOT NULL,
    "destinationAddressRaw" TEXT NOT NULL,
    "txHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "requiredConfirmations" INTEGER NOT NULL,
    "authorizedByDiscordId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "rejectedByDiscordId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "broadcastAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "signerBackend" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_quotes" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "usdPrice" DECIMAL(38,18) NOT NULL,
    "usdAmount" DECIMAL(18,2) NOT NULL,
    "cryptoAmount" DECIMAL(38,18) NOT NULL,
    "assetDecimals" INTEGER NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "kind" "WalletKind" NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "signerRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inUse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "openedByDiscordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "claimedByDiscordId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "resolvedByDiscordId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "frozenFromStatus" "DealStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_actions" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "actorId" TEXT,
    "actorDiscordId" TEXT NOT NULL,
    "type" "SupportActionType" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "actorId" TEXT,
    "actorDiscordId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "state_transitions" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStatus" "DealStatus" NOT NULL,
    "toStatus" "DealStatus" NOT NULL,
    "reason" TEXT,
    "actorDiscordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "state_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "supportRoleId" TEXT,
    "middlemanRoleId" TEXT,
    "adminRoleId" TEXT,
    "ticketCategoryId" TEXT,
    "archiveCategoryId" TEXT,
    "staffLogChannelId" TEXT,
    "feePercentage" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "minDealAmountUsd" DECIMAL(18,2) NOT NULL DEFAULT 5,
    "maxDealAmountUsd" DECIMAL(18,2) NOT NULL DEFAULT 100000,
    "enabledAssets" TEXT[] DEFAULT ARRAY['BTC', 'ETH', 'USDT', 'USDC']::TEXT[],
    "ticketCloseDelaySeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_counters" (
    "guildId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_counters_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE INDEX "users_discordId_idx" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channelId_key" ON "tickets"("channelId");

-- CreateIndex
CREATE INDEX "tickets_guildId_status_idx" ON "tickets"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guildId_sequence_key" ON "tickets"("guildId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "deals_publicId_key" ON "deals"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_ticketId_key" ON "deals"("ticketId");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_guildId_status_idx" ON "deals"("guildId", "status");

-- CreateIndex
CREATE INDEX "deals_buyerDiscordId_idx" ON "deals"("buyerDiscordId");

-- CreateIndex
CREATE INDEX "deals_sellerDiscordId_idx" ON "deals"("sellerDiscordId");

-- CreateIndex
CREATE INDEX "deals_partnerDiscordId_idx" ON "deals"("partnerDiscordId");

-- CreateIndex
CREATE INDEX "deals_expiresAt_idx" ON "deals"("expiresAt");

-- CreateIndex
CREATE INDEX "deal_participants_dealId_idx" ON "deal_participants"("dealId");

-- CreateIndex
CREATE INDEX "deal_participants_discordId_idx" ON "deal_participants"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_participants_dealId_userId_key" ON "deal_participants"("dealId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_participants_dealId_role_key" ON "deal_participants"("dealId", "role");

-- CreateIndex
CREATE INDEX "deal_details_dealId_idx" ON "deal_details"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_details_dealId_revision_key" ON "deal_details"("dealId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "payments_quoteId_key" ON "payments"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_depositAddress_idx" ON "payments"("depositAddress");

-- CreateIndex
CREATE INDEX "payments_dealId_idx" ON "payments"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_network_txHash_key" ON "payments"("network", "txHash");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_dealId_key" ON "payouts"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_quoteId_key" ON "payouts"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_idempotencyKey_key" ON "payouts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_network_txHash_key" ON "payouts"("network", "txHash");

-- CreateIndex
CREATE INDEX "price_quotes_asset_quotedAt_idx" ON "price_quotes"("asset", "quotedAt");

-- CreateIndex
CREATE INDEX "price_quotes_dealId_idx" ON "price_quotes"("dealId");

-- CreateIndex
CREATE INDEX "wallets_kind_asset_network_active_idx" ON "wallets"("kind", "asset", "network", "active");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_network_address_key" ON "wallets"("network", "address");

-- CreateIndex
CREATE INDEX "disputes_dealId_idx" ON "disputes"("dealId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "support_actions_dealId_idx" ON "support_actions"("dealId");

-- CreateIndex
CREATE INDEX "support_actions_actorDiscordId_idx" ON "support_actions"("actorDiscordId");

-- CreateIndex
CREATE INDEX "audit_logs_dealId_createdAt_idx" ON "audit_logs"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- CreateIndex
CREATE INDEX "state_transitions_dealId_createdAt_idx" ON "state_transitions"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_guildId_key" ON "guild_configs"("guildId");

-- CreateIndex
CREATE INDEX "idempotency_records_scope_idx" ON "idempotency_records"("scope");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_details" ADD CONSTRAINT "deal_details_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "price_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "price_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_quotes" ADD CONSTRAINT "price_quotes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_actions" ADD CONSTRAINT "support_actions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_actions" ADD CONSTRAINT "support_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

