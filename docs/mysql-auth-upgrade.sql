-- Bomberman-Yokonex 旧库认证功能升级 SQL
-- 用途：不使用 Prisma 迁移时，为现有数据库补充单账号会话和邮箱验证码结构。
-- 本脚本可重复执行，已经存在的字段、索引和表会自动跳过。

USE `bomberman_yokonex`;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'active_session_id'
  ),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `active_session_id` VARCHAR(191) NULL AFTER `current_score`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'email'
  ),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `email` VARCHAR(191) NULL AFTER `username`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'users_email_key'
  ),
  'SELECT 1',
  'CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `email_verification_codes` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(191) NOT NULL,
  `code_hash` VARCHAR(191) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `email_verification_codes_email_purpose_created_at_idx` (`email`, `purpose`, `created_at`),
  KEY `email_verification_codes_expires_at_idx` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
