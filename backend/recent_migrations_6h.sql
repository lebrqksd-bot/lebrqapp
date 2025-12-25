-- =====================================================
-- SQL Queries for Database Changes (Last 6 Hours)
-- Generated: Based on recent development work
-- =====================================================

-- =====================================================
-- 1. PERFORMANCE TEAM FIELDS - items table
-- =====================================================
-- Add video_url, profile_image_url, and profile_info columns
-- for performance team catalog items

-- Check if columns exist before adding
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'items' 
AND COLUMN_NAME IN ('video_url', 'profile_image_url', 'profile_info');

-- Add video_url column (if not exists)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS video_url VARCHAR(500) NULL COMMENT 'Video URL for performance team'
AFTER image_url;

-- Add profile_image_url column (if not exists)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500) NULL COMMENT 'Profile photo URL for performance team'
AFTER video_url;

-- Add profile_info column (if not exists)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS profile_info TEXT NULL COMMENT 'Profile information/description for performance team'
AFTER profile_image_url;

-- =====================================================
-- 2. ADMIN SETTINGS TABLE - for auto-approve feature
-- =====================================================
-- Create admin_settings table to store admin configuration
-- This table stores key-value pairs for admin settings

CREATE TABLE IF NOT EXISTS admin_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT 'Unique key for the setting (e.g., auto_approve_enabled)',
    value TEXT COMMENT 'Setting value (stored as text, can be boolean, number, or string)',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default auto-approve setting (if not exists)
INSERT INTO admin_settings (setting_key, value) 
VALUES ('auto_approve_enabled', 'false') 
ON DUPLICATE KEY UPDATE value = value;

-- =====================================================
-- 3. VERIFICATION QUERIES
-- =====================================================
-- Check if all columns were added successfully

-- Verify performance team columns in items table
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'items' 
AND COLUMN_NAME IN ('video_url', 'profile_image_url', 'profile_info')
ORDER BY ORDINAL_POSITION;

-- Verify admin_settings table exists
SHOW CREATE TABLE admin_settings;

-- Check current auto-approve setting
SELECT setting_key, value, updated_at 
FROM admin_settings 
WHERE setting_key = 'auto_approve_enabled';

-- =====================================================
-- 4. ROLLBACK QUERIES (if needed)
-- =====================================================
-- Use these only if you need to rollback the changes

-- Remove performance team columns (ROLLBACK)
-- ALTER TABLE items DROP COLUMN IF EXISTS video_url;
-- ALTER TABLE items DROP COLUMN IF EXISTS profile_image_url;
-- ALTER TABLE items DROP COLUMN IF EXISTS profile_info;

-- Drop admin_settings table (ROLLBACK)
-- DROP TABLE IF EXISTS admin_settings;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Performance Team Fields:
--    - These fields are optional (NULL allowed)
--    - Used only when item.category = 'team'
--    - video_url: YouTube or other video platform URL
--    - profile_image_url: Profile photo for the performance team
--    - profile_info: Detailed description/information about the team
--
-- 2. Admin Settings:
--    - Stores key-value pairs for admin configuration
--    - Currently used for auto-approve booking feature
--    - Can be extended for other admin settings in the future
--    - Auto-approve: When enabled, paid bookings are automatically approved
--
-- 3. Compatibility:
--    - All changes are backward compatible
--    - Existing data is not affected
--    - New columns are nullable, so existing rows work without modification

