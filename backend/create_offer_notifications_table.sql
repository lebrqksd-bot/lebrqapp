-- Create offer_notifications table to track which users have been informed about offers
CREATE TABLE IF NOT EXISTS offer_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    offer_id INT NOT NULL,
    user_id INT NOT NULL,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified_by_user_id INT NULL,
    INDEX idx_offer_id (offer_id),
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_offer_user (offer_id, user_id),
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notified_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

