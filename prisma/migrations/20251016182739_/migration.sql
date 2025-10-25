/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `plans` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `plans` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `status` on the `subscriptions` table. All the data in the column will be lost.
  - Added the required column `duration_unit` to the `plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration_value` to the `plans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DurationUnit" AS ENUM ('day', 'month', 'year');

-- AlterEnum
ALTER TYPE "public"."OrderType" ADD VALUE 'plan_purchase';

-- AlterTable
ALTER TABLE "public"."groups" DROP COLUMN "subscriptionId",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "subscriptionId",
ADD COLUMN     "duration_unit" "public"."DurationUnit" NOT NULL,
ADD COLUMN     "duration_value" INTEGER NOT NULL,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "public"."subscriptions" DROP COLUMN "status",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "start_at" TIMESTAMP(3);

-- DropEnum
DROP TYPE "public"."SubscriptionStatus";
