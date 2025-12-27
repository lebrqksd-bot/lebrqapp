-- Add WhatsApp keyword responses table if not exists
CREATE TABLE IF NOT EXISTS whatsapp_keyword_responses (
    id SERIAL PRIMARY KEY,
    keywords VARCHAR(500) NOT NULL,
    response TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    match_type VARCHAR(16) DEFAULT 'contains',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create index for faster queries on deleted_at
CREATE INDEX IF NOT EXISTS idx_whatsapp_keyword_responses_deleted_at 
ON whatsapp_keyword_responses(deleted_at);

-- Create index for faster queries on is_active
CREATE INDEX IF NOT EXISTS idx_whatsapp_keyword_responses_active 
ON whatsapp_keyword_responses(is_active);

-- Add WhatsApp quick replies table if not exists
CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES whatsapp_quick_replies(id) ON DELETE CASCADE,
    button_text VARCHAR(200) NOT NULL,
    message_text VARCHAR(500) NOT NULL,
    response_type VARCHAR(50) DEFAULT 'static',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for quick replies
CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_parent 
ON whatsapp_quick_replies(parent_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_active 
ON whatsapp_quick_replies(is_active);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_deleted 
ON whatsapp_quick_replies(deleted_at);

-- Add WhatsApp conversations table if not exists
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(32) NOT NULL,
    session_id VARCHAR(255),
    status VARCHAR(32) DEFAULT 'active',
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone 
ON whatsapp_conversations(phone_number);

-- Add WhatsApp messages table if not exists
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    direction VARCHAR(16) NOT NULL,
    message_type VARCHAR(32) DEFAULT 'text',
    content TEXT,
    media_url VARCHAR(1000),
    status VARCHAR(32) DEFAULT 'sent',
    external_id VARCHAR(255),
    message_metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation 
ON whatsapp_messages(conversation_id);

-- Add admin_settings table for auto-approve and refund percentage settings
CREATE TABLE IF NOT EXISTS admin_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admin_settings_setting_key_unique UNIQUE (setting_key)
);

-- Insert default settings (use DO block for safe insert)
DO $$
BEGIN
    INSERT INTO admin_settings (setting_key, value) VALUES ('auto_approve_enabled', 'false')
    ON CONFLICT (setting_key) DO NOTHING;
    
    INSERT INTO admin_settings (setting_key, value) VALUES ('refund_percentage', '40.0')
    ON CONFLICT (setting_key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if table already has data
    NULL;
END $$;
