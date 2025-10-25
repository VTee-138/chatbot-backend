-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('personal', 'groups');

-- CreateEnum
CREATE TYPE "public"."ChannelProvider" AS ENUM ('facebook', 'zalo', 'instagram');

-- CreateEnum
CREATE TYPE "public"."ChannelStatus" AS ENUM ('active', 'inactive', 'pending', 'error');

-- CreateEnum
CREATE TYPE "public"."GroupRole" AS ENUM ('manager', 'member', 'owner');

-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled', 'pending');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('text', 'image', 'file', 'audio', 'video', 'sticker');

-- CreateEnum
CREATE TYPE "public"."Direction" AS ENUM ('incoming', 'outgoing');

-- CreateEnum
CREATE TYPE "public"."SenderType" AS ENUM ('customer', 'bot');

-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "public"."AttachmentType" AS ENUM ('image', 'video', 'audio', 'file', 'sticker', 'location', 'contact');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "role" "public"."Role" NOT NULL DEFAULT 'user',
    "two_factor_backup_codes" TEXT[],
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "phone_number" TEXT,
    "user_name" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sso_accounts" (
    "provider" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,

    CONSTRAINT "sso_accounts_pkey" PRIMARY KEY ("provider","provider_id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "limits" JSONB NOT NULL,
    "type" "public"."PlanType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "auto_assign_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_model_credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "id" TEXT NOT NULL,
    "role" "public"."GroupRole" NOT NULL DEFAULT 'member',
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'accepted',
    "assignment_weight" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "expire_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage_logs" (
    "id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "public"."ChannelProvider" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "status" "public"."ChannelStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "chatbot_enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider_conversation_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_ad_id" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "phone_number" TEXT,
    "email" TEXT,
    "identity_number" TEXT,
    "address" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" "public"."Gender",
    "notes" TEXT,
    "group_id" TEXT NOT NULL,
    "tag_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "sender_type" "public"."SenderType" NOT NULL DEFAULT 'customer',
    "content" TEXT NOT NULL,
    "message_type" "public"."MessageType" NOT NULL DEFAULT 'text',
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'sent',
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "reply_to_message_id" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "attachment_type" "public"."AttachmentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "thumbnail_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "provider_file_id" TEXT,
    "provider_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_name_key" ON "public"."users"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_owner_id_key" ON "public"."groups"("name", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_user_id_group_id_key" ON "public"."group_members"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "subscriptions_group_id_idx" ON "public"."subscriptions"("group_id");

-- CreateIndex
CREATE INDEX "channels_group_id_idx" ON "public"."channels"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_provider_provider_id_key" ON "public"."channels"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_provider_conversation_id_key" ON "public"."conversations"("provider_conversation_id");

-- CreateIndex
CREATE INDEX "conversations_assignee_id_idx" ON "public"."conversations"("assignee_id");

-- CreateIndex
CREATE INDEX "conversations_group_id_idx" ON "public"."conversations"("group_id");

-- CreateIndex
CREATE INDEX "customers_group_id_idx" ON "public"."customers"("group_id");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "public"."customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_number_idx" ON "public"."customers"("phone_number");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "public"."message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "message_attachments_attachment_type_idx" ON "public"."message_attachments"("attachment_type");

-- AddForeignKey
ALTER TABLE "public"."sso_accounts" ADD CONSTRAINT "sso_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."channels" ADD CONSTRAINT "channels_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
