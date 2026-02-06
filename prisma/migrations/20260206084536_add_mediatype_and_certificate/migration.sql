/*
  Warnings:

  - You are about to drop the column `category_id` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `media_type_id` to the `assignments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RevisionType" AS ENUM ('PRE_TEST', 'POST_TEST');

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_category_id_fkey";

-- DropIndex
DROP INDEX "assignments_category_id_idx";

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "category_id",
ADD COLUMN     "media_type_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "submission_revisions" ADD COLUMN     "revision_type" "RevisionType" NOT NULL DEFAULT 'PRE_TEST';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "artwork_size" TEXT,
ADD COLUMN     "media_type_id" TEXT,
ADD COLUMN     "year_created" INTEGER;

-- DropTable
DROP TABLE "categories";

-- CreateTable
CREATE TABLE "media_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "artwork_title" TEXT NOT NULL,
    "media_type_id" TEXT NOT NULL,
    "artwork_size" TEXT NOT NULL,
    "year_created" INTEGER NOT NULL,
    "description" TEXT,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_types_name_key" ON "media_types"("name");

-- CreateIndex
CREATE INDEX "media_types_name_idx" ON "media_types"("name");

-- CreateIndex
CREATE INDEX "media_types_is_active_idx" ON "media_types"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_submission_id_key" ON "certificates"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_token_key" ON "certificates"("token");

-- CreateIndex
CREATE INDEX "certificates_submission_id_idx" ON "certificates"("submission_id");

-- CreateIndex
CREATE INDEX "certificates_student_id_idx" ON "certificates"("student_id");

-- CreateIndex
CREATE INDEX "certificates_token_idx" ON "certificates"("token");

-- CreateIndex
CREATE INDEX "assignments_media_type_id_idx" ON "assignments"("media_type_id");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
