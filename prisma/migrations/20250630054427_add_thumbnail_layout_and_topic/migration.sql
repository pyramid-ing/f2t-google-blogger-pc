/*
  Warnings:

  - The primary key for the `Topic` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `baseTopic` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `isAuto` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Topic` table. All the data in the column will be lost.
  - Added the required column `topic` to the `Topic` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ThumbnailLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "previewUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "target" TEXT,
    "keywords" TEXT,
    "tone" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Topic" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
