/*
  Warnings:

  - The values [customer] on the enum `SenderType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `conversation_channels` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[customer_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_id` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_message_id` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."SenderType_new" AS ENUM ('human', 'bot');
ALTER TABLE "public"."messages" ALTER COLUMN "sender_type" DROP DEFAULT;
ALTER TABLE "public"."messages" ALTER COLUMN "sender_type" TYPE "public"."SenderType_new" USING ("sender_type"::text::"public"."SenderType_new");
ALTER TYPE "public"."SenderType" RENAME TO "SenderType_old";
ALTER TYPE "public"."SenderType_new" RENAME TO "SenderType";
DROP TYPE "public"."SenderType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."conversation_channels" DROP CONSTRAINT "conversation_channels_channel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."conversation_channels" DROP CONSTRAINT "conversation_channels_conversation_id_fkey";

-- AlterTable
ALTER TABLE "public"."conversations" ADD COLUMN     "provider" "public"."ChannelProvider" NOT NULL,
ADD COLUMN     "provider_id" TEXT NOT NULL,
ALTER COLUMN "provider_conversation_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "provider_message_id" TEXT NOT NULL,
ADD COLUMN     "replied_to_message_id" TEXT,
ALTER COLUMN "sender_type" DROP NOT NULL,
ALTER COLUMN "sender_type" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."conversation_channels";

-- CreateIndex
CREATE UNIQUE INDEX "conversations_customer_id_key" ON "public"."conversations"("customer_id");
