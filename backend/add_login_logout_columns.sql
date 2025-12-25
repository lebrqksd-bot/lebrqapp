-- Add login and logout time columns to users table
ALTER TABLE users 
ADD COLUMN last_login_time DATETIME NULL,
ADD COLUMN last_logout_time DATETIME NULL;
