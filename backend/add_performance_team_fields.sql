-- Migration script to add performance team fields to items table
-- Run this script on your MySQL database

ALTER TABLE items
ADD COLUMN video_url VARCHAR(500) NULL COMMENT 'Video URL for performance team',
ADD COLUMN profile_image_url VARCHAR(500) NULL COMMENT 'Profile photo URL for performance team',
ADD COLUMN profile_info TEXT NULL COMMENT 'Profile information/description for performance team';

