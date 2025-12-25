-- ============================================
-- MYSQL DEPLOYMENT MIGRATION SCRIPT
-- Contest System Tables
-- ============================================
-- This script creates all contest system tables for deployment
-- Run this on your production/staging MySQL database
-- 
-- IMPORTANT: 
-- 1. Backup your database before running this script
-- 2. Make sure you're connected to the correct database
-- 3. Verify that referenced tables (users, bookings) exist
-- 4. Run this script as a user with CREATE TABLE privileges
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================
-- 1. CONTESTS TABLE
-- ============================================
DROP TABLE IF EXISTS `contests`;
CREATE TABLE `contests` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `hero_image_url` VARCHAR(500) NULL,
    `banner_image_url` VARCHAR(500) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `applicable_event_types` JSON NULL,
    `first_x_winners` INT(11) NULL,
    `eligibility_criteria` TEXT NULL,
    `per_user_limit` INT(11) NOT NULL DEFAULT 1,
    `auto_approve` TINYINT(1) NOT NULL DEFAULT 0,
    `prizes` JSON NULL,
    `is_published` TINYINT(1) NOT NULL DEFAULT 0,
    `created_by_user_id` INT(11) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `slug` (`slug`),
    KEY `idx_contests_start_date` (`start_date`),
    KEY `idx_contests_end_date` (`end_date`),
    KEY `idx_contests_is_published` (`is_published`),
    KEY `fk_contests_created_by_user` (`created_by_user_id`),
    CONSTRAINT `fk_contests_created_by_user` FOREIGN KEY (`created_by_user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 2. CONTEST_ENTRIES TABLE
-- ============================================
DROP TABLE IF EXISTS `contest_entries`;
CREATE TABLE `contest_entries` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `contest_id` INT(11) NOT NULL,
    `participant_name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(32) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `event_date` DATE NOT NULL,
    `relation` VARCHAR(50) NOT NULL DEFAULT 'self',
    `booking_id` INT(11) NULL,
    `message` TEXT NULL,
    `owner_email` VARCHAR(255) NULL,
    `owner_phone` VARCHAR(32) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `admin_note` TEXT NULL,
    `ocr_confidence` FLOAT NULL,
    `ocr_date_matches` TINYINT(1) NULL,
    `ocr_extracted_text` TEXT NULL,
    `reference_id` VARCHAR(50) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `approved_at` DATETIME NULL,
    `marked_winner_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `reference_id` (`reference_id`),
    KEY `idx_contest_entries_contest_id` (`contest_id`),
    KEY `idx_contest_entries_email` (`email`),
    KEY `idx_contest_entries_phone` (`phone`),
    KEY `idx_contest_entries_event_date` (`event_date`),
    KEY `idx_contest_entries_status` (`status`),
    KEY `idx_contest_entries_owner_email` (`owner_email`),
    KEY `idx_contest_entries_owner_phone` (`owner_phone`),
    KEY `idx_contest_entries_created_at` (`created_at`),
    KEY `fk_contest_entries_booking` (`booking_id`),
    CONSTRAINT `fk_contest_entries_contest` FOREIGN KEY (`contest_id`) 
        REFERENCES `contests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_contest_entries_booking` FOREIGN KEY (`booking_id`) 
        REFERENCES `bookings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 3. CONTEST_ENTRY_FILES TABLE
-- ============================================
DROP TABLE IF EXISTS `contest_entry_files`;
CREATE TABLE `contest_entry_files` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `entry_id` INT(11) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(50) NOT NULL,
    `file_size` INT(11) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_contest_entry_files_entry_id` (`entry_id`),
    CONSTRAINT `fk_contest_entry_files_entry` FOREIGN KEY (`entry_id`) 
        REFERENCES `contest_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 4. CONTEST_NOTIFICATIONS TABLE
-- ============================================
DROP TABLE IF EXISTS `contest_notifications`;
CREATE TABLE `contest_notifications` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `entry_id` INT(11) NOT NULL,
    `channel` VARCHAR(50) NOT NULL,
    `recipient_email` VARCHAR(255) NULL,
    `recipient_phone` VARCHAR(32) NULL,
    `subject` VARCHAR(255) NULL,
    `message_body` TEXT NOT NULL,
    `provider_response` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `sent_by_user_id` INT(11) NULL,
    `sent_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_contest_notifications_entry_id` (`entry_id`),
    KEY `fk_contest_notifications_sent_by` (`sent_by_user_id`),
    CONSTRAINT `fk_contest_notifications_entry` FOREIGN KEY (`entry_id`) 
        REFERENCES `contest_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_contest_notifications_sent_by` FOREIGN KEY (`sent_by_user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 5. USER_EVENT_DATES TABLE
-- ============================================
DROP TABLE IF EXISTS `user_event_dates`;
CREATE TABLE `user_event_dates` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(32) NULL,
    `person_name` VARCHAR(200) NOT NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `event_date` DATE NOT NULL,
    `relation` VARCHAR(50) NOT NULL DEFAULT 'family',
    `notify_on_offers` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_event_dates_email` (`email`),
    KEY `idx_user_event_dates_phone` (`phone`),
    KEY `idx_user_event_dates_event_date` (`event_date`),
    KEY `idx_user_event_dates_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COMMIT TRANSACTION
-- ============================================
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify tables were created

SELECT 
    'Tables Created' AS status,
    COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema = DATABASE()
AND table_name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates');

SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.tables
WHERE table_schema = DATABASE()
AND table_name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY TABLE_NAME;

