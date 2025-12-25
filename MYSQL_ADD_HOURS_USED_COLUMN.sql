-- Migration: Add hours_used column to booking_items table
-- This column is used for hour-based pricing on paid add-ons

-- Add hours_used column to booking_items table
ALTER TABLE `booking_items` 
ADD COLUMN `hours_used` INT NULL 
COMMENT 'Hours used for this item (for hour-based pricing)' 
AFTER `accepted_at`;

-- Verify the column was added
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'booking_items'
    AND COLUMN_NAME = 'hours_used';

