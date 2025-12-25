-- Update WhatsApp Quick Replies Table to support sub-questions and dynamic responses
-- Run this on your live server

ALTER TABLE `whatsapp_quick_replies` 
ADD COLUMN `parent_id` BIGINT NULL COMMENT 'Parent quick reply ID for sub-questions' AFTER `id`,
ADD COLUMN `response_type` VARCHAR(50) DEFAULT 'static' COMMENT 'Response type: static, price, slots, contact' AFTER `message_text`,
ADD INDEX `idx_parent_id` (`parent_id`),
ADD FOREIGN KEY (`parent_id`) REFERENCES `whatsapp_quick_replies`(`id`) ON DELETE CASCADE;

-- Update existing records to have static response type
UPDATE `whatsapp_quick_replies` SET `response_type` = 'static' WHERE `response_type` IS NULL;

