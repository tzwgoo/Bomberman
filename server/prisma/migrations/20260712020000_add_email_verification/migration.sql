-- AlterTable
ALTER TABLE `users` ADD COLUMN `email` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);

-- CreateTable
CREATE TABLE `email_verification_codes` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_verification_codes_email_purpose_created_at_idx`(`email`, `purpose`, `created_at`),
    INDEX `email_verification_codes_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
