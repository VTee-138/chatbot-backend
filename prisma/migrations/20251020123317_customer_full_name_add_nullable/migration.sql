/*
  Warnings:

  - Made the column `sender_type` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."customers" ALTER COLUMN "full_name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "src" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "sender_type" SET NOT NULL;
