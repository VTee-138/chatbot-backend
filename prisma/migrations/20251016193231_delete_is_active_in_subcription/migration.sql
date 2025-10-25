/*
  Warnings:

  - You are about to drop the column `method` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "method",
ADD COLUMN     "payment_provider" TEXT;

-- AlterTable
ALTER TABLE "public"."subscriptions" DROP COLUMN "is_active";
