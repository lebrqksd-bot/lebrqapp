-- Migration: Add admin_viewed_at columns to bookings and users tables
-- This migration adds columns for tracking when admin has viewed bookings/clients (for badge tracking)

-- Add admin_viewed_at column to bookings table
ALTER TABLE `bookings` 
ADD COLUMN `admin_viewed_at` DATETIME NULL 
COMMENT 'When admin viewed this booking (for badge tracking)' 
AFTER `broker_settled_by_user_id`;

-- Add admin_viewed_at column to users table
ALTER TABLE `users` 
ADD COLUMN `admin_viewed_at` DATETIME NULL 
COMMENT 'When admin viewed this user (for badge tracking)' 
AFTER `suspended_until`;

-- Verify the columns were added
SELECT 
    TABLE_NAME,
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('bookings', 'users')
    AND COLUMN_NAME = 'admin_viewed_at';

