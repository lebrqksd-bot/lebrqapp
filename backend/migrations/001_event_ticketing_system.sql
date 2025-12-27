-- ============================================================
-- EVENT TICKETING SYSTEM MIGRATION
-- Run in Supabase SQL Editor
-- Version: 1.0
-- Date: 2025-12-27
-- ============================================================
-- 
-- This migration adds proper event management tables while
-- maintaining full backward compatibility with existing data.
--
-- IMPORTANT: Run this in a single transaction
-- ============================================================

BEGIN;

-- ============================================================
-- 1. MASTER EVENTS TABLE (event_definitions)
-- Stores event templates/definitions
-- ============================================================

CREATE TABLE IF NOT EXISTS event_definitions (
    id SERIAL PRIMARY KEY,
    
    -- Event identification
    event_code VARCHAR(50) UNIQUE NOT NULL,  -- 'yoga-morning', 'zumba-evening', 'live-show-xyz'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    event_category VARCHAR(50) NOT NULL,  -- 'wellness', 'live-show', 'workshop'
    event_type VARCHAR(50) NOT NULL,      -- 'yoga', 'zumba', 'concert', 'comedy'
    
    -- Recurrence pattern
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none',  -- 'none', 'daily', 'weekly'
    recurrence_days VARCHAR(50),  -- '1,2,3,4,5,6,7' for weekdays (1=Monday, 7=Sunday)
    
    -- Default timing (for recurring events)
    default_start_time TIME,  -- '07:00:00' for yoga
    default_end_time TIME,    -- '08:00:00' for yoga
    default_duration_minutes INT DEFAULT 60,
    
    -- Capacity & Pricing
    max_tickets INT DEFAULT 50,
    default_ticket_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- Venue linkage
    space_id INT REFERENCES spaces(id) ON DELETE SET NULL,
    venue_id INT REFERENCES venues(id) ON DELETE SET NULL,
    
    -- Display
    banner_image_url TEXT,
    poster_url TEXT,
    voice_instructions TEXT,  -- Voice instructions for the event
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE event_definitions IS 'Master event template/definition table';
COMMENT ON COLUMN event_definitions.event_code IS 'Unique identifier like yoga-morning, zumba-evening';
COMMENT ON COLUMN event_definitions.recurrence_type IS 'none=one-time, daily=every day, weekly=specific days';
COMMENT ON COLUMN event_definitions.recurrence_days IS 'Comma-separated day numbers (1=Mon to 7=Sun) for weekly recurrence';


-- ============================================================
-- 2. EVENT SCHEDULES TABLE (event_schedules)
-- Stores specific occurrences/instances of events
-- ============================================================

CREATE TABLE IF NOT EXISTS event_schedules (
    id SERIAL PRIMARY KEY,
    
    -- Link to definition
    event_definition_id INT NOT NULL REFERENCES event_definitions(id) ON DELETE CASCADE,
    
    -- Link to booking (for backward compatibility with admin-created events)
    booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
    
    -- Schedule specifics
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Capacity for this specific occurrence
    max_tickets INT NOT NULL,
    tickets_sold INT DEFAULT 0,
    
    -- Pricing override (if different from default)
    ticket_price DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',  -- 'scheduled', 'cancelled', 'completed'
    is_blocked BOOLEAN DEFAULT FALSE,  -- Blocks slot without selling tickets
    
    -- Notes
    admin_note TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one schedule per event per date/time
    CONSTRAINT unique_event_schedule UNIQUE(event_definition_id, schedule_date, start_time)
);

COMMENT ON TABLE event_schedules IS 'Specific occurrence/instance of an event';
COMMENT ON COLUMN event_schedules.tickets_sold IS 'Updated after payment verification only';
COMMENT ON COLUMN event_schedules.is_blocked IS 'Set to TRUE to block time slot without selling tickets';


-- ============================================================
-- 3. TICKET TYPES TABLE (ticket_types)
-- Optional: for events with multiple ticket tiers
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_types (
    id SERIAL PRIMARY KEY,
    event_definition_id INT NOT NULL REFERENCES event_definitions(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,  -- 'Standard', 'VIP', 'Early Bird'
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    max_quantity INT,  -- NULL = unlimited
    
    -- Features/perks included with this ticket type
    perks TEXT,  -- JSON array or comma-separated list
    
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ticket_types IS 'Ticket type variants for events (Standard, VIP, etc.)';


-- ============================================================
-- 4. ADD COLUMNS TO EXISTING BOOKINGS TABLE
-- These are nullable to maintain backward compatibility
-- ============================================================

-- Add event_schedule_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'event_schedule_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN event_schedule_id INT REFERENCES event_schedules(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add event_definition_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'event_definition_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN event_definition_id INT REFERENCES event_definitions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add ticket_type_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'ticket_type_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN ticket_type_id INT REFERENCES ticket_types(id) ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================
-- 5. ADD COLUMNS TO PROGRAM_PARTICIPANTS TABLE
-- These link participants to specific event schedules
-- ============================================================

-- Add event_schedule_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'program_participants' AND column_name = 'event_schedule_id'
    ) THEN
        ALTER TABLE program_participants ADD COLUMN event_schedule_id INT REFERENCES event_schedules(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add event_definition_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'program_participants' AND column_name = 'event_definition_id'
    ) THEN
        ALTER TABLE program_participants ADD COLUMN event_definition_id INT REFERENCES event_definitions(id) ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_definitions_category ON event_definitions(event_category);
CREATE INDEX IF NOT EXISTS idx_event_definitions_type ON event_definitions(event_type);
CREATE INDEX IF NOT EXISTS idx_event_definitions_active ON event_definitions(is_active);

CREATE INDEX IF NOT EXISTS idx_event_schedules_date ON event_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_event_schedules_definition ON event_schedules(event_definition_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_booking ON event_schedules(booking_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_status ON event_schedules(status);
CREATE INDEX IF NOT EXISTS idx_event_schedules_date_status ON event_schedules(schedule_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_event_schedule ON bookings(event_schedule_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_definition ON bookings(event_definition_id);

CREATE INDEX IF NOT EXISTS idx_participants_event_schedule ON program_participants(event_schedule_id);
CREATE INDEX IF NOT EXISTS idx_participants_event_definition ON program_participants(event_definition_id);


-- ============================================================
-- 7. HELPER FUNCTION: Generate Recurring Schedules
-- ============================================================

CREATE OR REPLACE FUNCTION generate_recurring_schedules(
    p_event_definition_id INT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INT AS $$
DECLARE
    v_event event_definitions%ROWTYPE;
    v_current_date DATE;
    v_day_of_week INT;
    v_days_array INT[];
    v_count INT := 0;
BEGIN
    -- Get event definition
    SELECT * INTO v_event FROM event_definitions WHERE id = p_event_definition_id;
    
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event definition not found: %', p_event_definition_id;
    END IF;
    
    IF v_event.recurrence_type = 'none' THEN
        RETURN 0;  -- Non-recurring event
    END IF;
    
    -- Parse recurrence days (default to all days)
    IF v_event.recurrence_days IS NOT NULL AND v_event.recurrence_days != '' THEN
        v_days_array := string_to_array(v_event.recurrence_days, ',')::INT[];
    ELSE
        v_days_array := ARRAY[1,2,3,4,5,6,7];  -- All days
    END IF;
    
    -- Generate schedules for date range
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
        -- EXTRACT(ISODOW FROM date) returns 1=Monday, 7=Sunday
        v_day_of_week := EXTRACT(ISODOW FROM v_current_date)::INT;
        
        IF v_day_of_week = ANY(v_days_array) THEN
            -- Insert schedule (ignore if already exists due to UNIQUE constraint)
            INSERT INTO event_schedules (
                event_definition_id,
                schedule_date,
                start_time,
                end_time,
                max_tickets,
                ticket_price,
                status
            ) VALUES (
                v_event.id,
                v_current_date,
                v_event.default_start_time,
                v_event.default_end_time,
                v_event.max_tickets,
                v_event.default_ticket_price,
                'scheduled'
            )
            ON CONFLICT ON CONSTRAINT unique_event_schedule DO NOTHING;
            
            IF FOUND THEN
                v_count := v_count + 1;
            END IF;
        END IF;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_recurring_schedules IS 
'Generate event schedules for recurring events within a date range. Returns count of schedules created.';


-- ============================================================
-- 8. HELPER FUNCTION: Check Ticket Availability
-- ============================================================

CREATE OR REPLACE FUNCTION check_ticket_availability(
    p_schedule_id INT,
    p_requested_quantity INT DEFAULT 1
) RETURNS TABLE (
    is_available BOOLEAN,
    available_tickets INT,
    message TEXT
) AS $$
DECLARE
    v_schedule event_schedules%ROWTYPE;
    v_available INT;
BEGIN
    SELECT * INTO v_schedule FROM event_schedules WHERE id = p_schedule_id;
    
    IF v_schedule IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'Schedule not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_schedule.status != 'scheduled' THEN
        RETURN QUERY SELECT FALSE, 0, ('Event is ' || v_schedule.status)::TEXT;
        RETURN;
    END IF;
    
    v_available := v_schedule.max_tickets - v_schedule.tickets_sold;
    
    IF v_available < p_requested_quantity THEN
        RETURN QUERY SELECT FALSE, v_available, ('Only ' || v_available || ' tickets available')::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_available, 'Tickets available'::TEXT;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 9. HELPER FUNCTION: Reserve Tickets (Atomic)
-- Call this ONLY after payment verification
-- ============================================================

CREATE OR REPLACE FUNCTION reserve_tickets(
    p_schedule_id INT,
    p_quantity INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INT;
BEGIN
    -- Lock the row and check availability
    SELECT (max_tickets - tickets_sold) INTO v_available
    FROM event_schedules
    WHERE id = p_schedule_id
    FOR UPDATE;
    
    IF v_available IS NULL THEN
        RETURN FALSE;  -- Schedule not found
    END IF;
    
    IF v_available < p_quantity THEN
        RETURN FALSE;  -- Not enough tickets
    END IF;
    
    -- Reserve tickets
    UPDATE event_schedules
    SET tickets_sold = tickets_sold + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_schedule_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 10. VIEW: Event Availability
-- Combines event definitions with schedules for easy querying
-- ============================================================

CREATE OR REPLACE VIEW v_event_availability AS
SELECT 
    ed.id AS event_definition_id,
    ed.event_code,
    ed.title,
    ed.description,
    ed.event_category,
    ed.event_type,
    ed.banner_image_url,
    ed.poster_url,
    ed.default_ticket_price,
    ed.space_id,
    ed.venue_id,
    es.id AS schedule_id,
    es.schedule_date,
    es.start_time,
    es.end_time,
    (es.schedule_date + es.start_time) AS start_datetime,
    (es.schedule_date + es.end_time) AS end_datetime,
    es.max_tickets,
    es.tickets_sold,
    (es.max_tickets - es.tickets_sold) AS tickets_available,
    COALESCE(es.ticket_price, ed.default_ticket_price) AS effective_price,
    es.status AS schedule_status,
    es.booking_id AS linked_booking_id
FROM event_definitions ed
JOIN event_schedules es ON es.event_definition_id = ed.id
WHERE ed.is_active = TRUE;


-- ============================================================
-- 11. VIEW: Schedule Participants
-- Lists participants per schedule with user details
-- ============================================================

CREATE OR REPLACE VIEW v_schedule_participants AS
SELECT 
    es.id AS schedule_id,
    es.schedule_date,
    ed.title AS event_title,
    ed.event_type,
    pp.id AS participant_id,
    pp.user_id,
    pp.name AS participant_name,
    pp.mobile,
    pp.ticket_quantity,
    pp.amount_paid,
    pp.is_verified,
    pp.scan_count,
    pp.joined_at,
    pp.booking_id,
    b.booking_reference,
    b.status AS booking_status,
    u.username AS user_email,
    u.first_name,
    u.last_name
FROM event_schedules es
JOIN event_definitions ed ON ed.id = es.event_definition_id
LEFT JOIN program_participants pp ON pp.event_schedule_id = es.id
LEFT JOIN bookings b ON b.id = pp.booking_id
LEFT JOIN users u ON u.id = pp.user_id;


-- ============================================================
-- 12. TRIGGER: Update timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Event definitions
DROP TRIGGER IF EXISTS update_event_definitions_updated_at ON event_definitions;
CREATE TRIGGER update_event_definitions_updated_at
    BEFORE UPDATE ON event_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Event schedules
DROP TRIGGER IF EXISTS update_event_schedules_updated_at ON event_schedules;
CREATE TRIGGER update_event_schedules_updated_at
    BEFORE UPDATE ON event_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


COMMIT;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Event ticketing migration completed successfully!';
    RAISE NOTICE 'New tables created: event_definitions, event_schedules, ticket_types';
    RAISE NOTICE 'New columns added to: bookings, program_participants';
    RAISE NOTICE 'Functions created: generate_recurring_schedules, check_ticket_availability, reserve_tickets';
    RAISE NOTICE 'Views created: v_event_availability, v_schedule_participants';
END $$;
