-- CreateEnum
CREATE TYPE "MateriType" AS ENUM ('FILE', 'LINK');

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_media_type_id_fkey";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "materi_type" "MateriType",
ADD COLUMN     "materi_url" TEXT;

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "file_url" TEXT,
ALTER COLUMN "media_type_id" DROP NOT NULL,
ALTER COLUMN "artwork_size" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
