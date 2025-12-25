-- Create WhatsApp Quick Replies Table
-- This table stores quick reply buttons shown after greeting messages

CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    button_text VARCHAR(200) NOT NULL COMMENT 'Text displayed on button (e.g., Price, Today Slot)',
    message_text VARCHAR(500) NOT NULL COMMENT 'Message sent when button is clicked (e.g., price, cost, today slot)',
    display_order INT DEFAULT 0 COMMENT 'Order in which buttons appear (lower = first)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable this quick reply button',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_display_order (display_order),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample quick replies
INSERT INTO whatsapp_quick_replies (button_text, message_text, display_order, is_active) VALUES
('Price', 'price', 1, TRUE),
('Cost', 'cost', 2, TRUE),
('Today Slot', 'today slot', 3, TRUE)
ON DUPLICATE KEY UPDATE button_text=button_text;

