/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_id,group_id]` on the table `channels` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."channels_provider_provider_id_key";

-- AlterTable
ALTER TABLE "public"."channels" ADD COLUMN     "expire_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "channels_provider_provider_id_group_id_key" ON "public"."channels"("provider", "provider_id", "group_id");
