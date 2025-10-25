/*
  Warnings:

  - You are about to drop the column `channel_id` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `conversations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."conversations" DROP CONSTRAINT "conversations_channel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."conversations" DROP CONSTRAINT "conversations_group_id_fkey";

-- DropIndex
DROP INDEX "public"."conversations_group_id_idx";

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."ai_usage_logs" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."conversations" DROP COLUMN "channel_id",
DROP COLUMN "group_id",
ADD COLUMN     "provider_customer_id" TEXT;

-- AlterTable
ALTER TABLE "public"."message_attachments" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."sso_accounts" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."conversation_channels" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "conversation_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_channels_conversation_id_channel_id_key" ON "public"."conversation_channels"("conversation_id", "channel_id");

-- AddForeignKey
ALTER TABLE "public"."conversation_channels" ADD CONSTRAINT "conversation_channels_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_channels" ADD CONSTRAINT "conversation_channels_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
