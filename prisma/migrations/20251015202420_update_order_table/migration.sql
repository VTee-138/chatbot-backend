/*
  Warnings:

  - You are about to drop the column `target_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `target_type` on the `Order` table. All the data in the column will be lost.
  - Added the required column `type` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('group_creation', 'plan_renewal', 'credit_purchase');

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "target_id",
DROP COLUMN "target_type",
ADD COLUMN     "data" JSONB,
ADD COLUMN     "type" "public"."OrderType" NOT NULL;
