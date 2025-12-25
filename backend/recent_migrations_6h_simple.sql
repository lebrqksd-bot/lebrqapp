-- =====================================================
-- SQL Queries for Last 6 Hours - Simple Executable Version
-- Run this file directly on your MySQL database
-- =====================================================

-- =====================================================
-- 1. Add Performance Team Fields to items table
-- =====================================================
-- Note: If columns already exist, these will fail with "Duplicate column" error
-- That's okay - it means the migration was already run

-- Add video_url column
ALTER TABLE items
ADD COLUMN video_url VARCHAR(500) NULL COMMENT 'Video URL for performance team'
AFTER image_url;

-- Add profile_image_url column
ALTER TABLE items
ADD COLUMN profile_image_url VARCHAR(500) NULL COMMENT 'Profile photo URL for performance team'
AFTER video_url;

-- Add profile_info column
ALTER TABLE items
ADD COLUMN profile_info TEXT NULL COMMENT 'Profile information/description for performance team'
AFTER profile_image_url;

-- =====================================================
-- 2. Create admin_settings table for auto-approve feature
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default auto-approve setting
INSERT INTO admin_settings (setting_key, value) 
VALUES ('auto_approve_enabled', 'false') 
ON DUPLICATE KEY UPDATE value = value;

-- =====================================================
-- Verification Queries (Optional - run to verify)
-- =====================================================

-- Check performance team columns
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'items' 
AND COLUMN_NAME IN ('video_url', 'profile_image_url', 'profile_info');

-- Check admin_settings table
SELECT * FROM admin_settings;

