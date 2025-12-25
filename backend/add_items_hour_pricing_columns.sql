-- Migration: Add hour-based pricing columns to items table
-- This migration adds columns for hour-based pricing on paid add-ons

-- Add base_hours_included column
ALTER TABLE `items` 
ADD COLUMN `base_hours_included` INT DEFAULT 0 
COMMENT 'Base hours included in price (e.g., 3 hours)' 
AFTER `preparation_time_minutes`;

-- Add rate_per_extra_hour column
ALTER TABLE `items` 
ADD COLUMN `rate_per_extra_hour` DECIMAL(10,2) DEFAULT 0.00 
COMMENT 'Rate per extra hour beyond base hours (e.g., ₹1000/hour)' 
AFTER `base_hours_included`;

-- Add is_eligible_for_space_offer column (if not exists)
ALTER TABLE `items` 
ADD COLUMN `is_eligible_for_space_offer` BOOLEAN DEFAULT TRUE 
COMMENT 'Whether this item is eligible for space offers (halls, meeting rooms, programs)' 
AFTER `rate_per_extra_hour`;

-- Verify the columns were added
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME IN ('base_hours_included', 'rate_per_extra_hour', 'is_eligible_for_space_offer');

