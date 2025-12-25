-- Migration: Create rack_orders table
-- This table stores orders placed for rack products, including surprise gift information

CREATE TABLE IF NOT EXISTS rack_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    rack_id INT NOT NULL,
    
    -- Order details
    order_reference VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(10,2) NOT NULL,
    original_amount DECIMAL(10,2) NULL COMMENT 'Amount before discount',
    items_json JSON NOT NULL COMMENT 'Cart items: [{product_id, name, price, quantity, subtotal}, ...]',
    
    -- Offer details
    applied_offer_id INT NULL,
    discount_amount DECIMAL(10,2) NULL,
    
    -- Surprise gift fields
    is_surprise_gift BOOLEAN DEFAULT FALSE,
    recipient_name VARCHAR(255) NULL,
    recipient_mobile VARCHAR(15) NULL,
    delivery_address TEXT NULL,
    pin_code VARCHAR(10) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    occasion_type VARCHAR(50) NULL COMMENT 'birthday, anniversary, other',
    birthday_date DATETIME NULL,
    personal_message TEXT NULL,
    
    -- Payment details
    payment_id INT NULL,
    payment_status VARCHAR(32) DEFAULT 'pending' COMMENT 'pending, completed, failed',
    
    -- Status
    status VARCHAR(32) DEFAULT 'pending' COMMENT 'pending, confirmed, shipped, delivered, cancelled',
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_rack_id (rack_id),
    INDEX idx_order_reference (order_reference),
    INDEX idx_payment_status (payment_status),
    INDEX idx_status (status),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rack_id) REFERENCES racks(id) ON DELETE CASCADE,
    FOREIGN KEY (applied_offer_id) REFERENCES offers(id) ON DELETE SET NULL,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

