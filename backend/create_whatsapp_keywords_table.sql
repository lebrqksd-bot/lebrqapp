-- Create WhatsApp Keyword Responses Table
-- This table stores keyword-based auto-reply configurations for the WhatsApp chatbot

CREATE TABLE IF NOT EXISTS whatsapp_keyword_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keywords VARCHAR(500) NOT NULL COMMENT 'Comma-separated keywords to match',
    response TEXT NOT NULL COMMENT 'Response message to send when keywords match',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable this keyword response',
    match_type VARCHAR(16) DEFAULT 'contains' COMMENT 'Match type: contains, exact, starts_with, ends_with',
    priority INT DEFAULT 0 COMMENT 'Higher priority checked first',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

