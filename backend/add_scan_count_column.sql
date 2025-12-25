-- Migration script to add scan_count column to program_participants table
-- Run this SQL script directly in your MySQL database

-- Check if column exists and add it if it doesn't
-- For MySQL 5.7+, you can use this approach:

ALTER TABLE program_participants
ADD COLUMN IF NOT EXISTS scan_count INT DEFAULT 0 NOT NULL;

-- If your MySQL version doesn't support IF NOT EXISTS (MySQL < 5.7),
-- use this instead (it will error if column already exists, but that's safe):

-- ALTER TABLE program_participants
-- ADD COLUMN scan_count INT DEFAULT 0 NOT NULL;

-- To verify the column was added:
-- DESCRIBE program_participants;
-- or
-- SHOW COLUMNS FROM program_participants LIKE 'scan_count';

