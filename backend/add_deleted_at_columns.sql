-- Migration script to add deleted_at column for soft delete functionality
-- Run this script on your database to add the deleted_at columns

-- Add deleted_at column to whatsapp_keyword_responses table
ALTER TABLE whatsapp_keyword_responses 
ADD COLUMN deleted_at DATETIME NULL COMMENT 'Soft delete timestamp';

-- Add deleted_at column to whatsapp_quick_replies table
ALTER TABLE whatsapp_quick_replies 
ADD COLUMN deleted_at DATETIME NULL COMMENT 'Soft delete timestamp';

-- Create indexes for better query performance on deleted_at columns
CREATE INDEX idx_whatsapp_keyword_responses_deleted_at ON whatsapp_keyword_responses(deleted_at);
CREATE INDEX idx_whatsapp_quick_replies_deleted_at ON whatsapp_quick_replies(deleted_at);

