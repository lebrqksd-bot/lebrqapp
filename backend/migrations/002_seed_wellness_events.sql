-- ============================================================
-- SEED DATA: Initial Event Definitions
-- Run AFTER 001_event_ticketing_system.sql
-- ============================================================

BEGIN;

-- ============================================================
-- SEED WELLNESS EVENTS (Yoga & Zumba)
-- ============================================================

-- Morning Yoga (7:00 AM - 8:00 AM, Monday-Saturday)
INSERT INTO event_definitions (
    event_code,
    title,
    description,
    event_category,
    event_type,
    recurrence_type,
    recurrence_days,
    default_start_time,
    default_end_time,
    default_duration_minutes,
    max_tickets,
    default_ticket_price,
    space_id,
    is_active
) VALUES (
    'yoga-morning',
    'Morning Yoga Session',
    'Start your day with rejuvenating yoga session. Suitable for all levels.',
    'wellness',
    'yoga',
    'daily',
    '1,2,3,4,5,6',  -- Monday to Saturday
    '07:00:00',
    '08:00:00',
    60,
    30,  -- Max 30 participants
    0.00,  -- Free (adjust if needed)
    NULL,  -- Set space_id after checking your spaces table
    TRUE
) ON CONFLICT (event_code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    default_start_time = EXCLUDED.default_start_time,
    default_end_time = EXCLUDED.default_end_time,
    max_tickets = EXCLUDED.max_tickets,
    default_ticket_price = EXCLUDED.default_ticket_price,
    updated_at = CURRENT_TIMESTAMP;


-- Morning Zumba (6:00 AM - 7:00 AM, Monday-Saturday)
INSERT INTO event_definitions (
    event_code,
    title,
    description,
    event_category,
    event_type,
    recurrence_type,
    recurrence_days,
    default_start_time,
    default_end_time,
    default_duration_minutes,
    max_tickets,
    default_ticket_price,
    space_id,
    is_active
) VALUES (
    'zumba-morning',
    'Morning Zumba Class',
    'High-energy Zumba fitness class. Dance your way to fitness!',
    'wellness',
    'zumba',
    'daily',
    '1,2,3,4,5,6',  -- Monday to Saturday
    '06:00:00',
    '07:00:00',
    60,
    40,  -- Max 40 participants
    0.00,  -- Free (adjust if needed)
    NULL,  -- Set space_id after checking your spaces table
    TRUE
) ON CONFLICT (event_code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    default_start_time = EXCLUDED.default_start_time,
    default_end_time = EXCLUDED.default_end_time,
    max_tickets = EXCLUDED.max_tickets,
    default_ticket_price = EXCLUDED.default_ticket_price,
    updated_at = CURRENT_TIMESTAMP;


-- ============================================================
-- GENERATE SCHEDULES FOR NEXT 30 DAYS
-- ============================================================

-- Generate Yoga schedules
SELECT generate_recurring_schedules(
    (SELECT id FROM event_definitions WHERE event_code = 'yoga-morning'),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE
);

-- Generate Zumba schedules
SELECT generate_recurring_schedules(
    (SELECT id FROM event_definitions WHERE event_code = 'zumba-morning'),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE
);


-- ============================================================
-- VERIFY SEED DATA
-- ============================================================

DO $$
DECLARE
    v_yoga_count INT;
    v_zumba_count INT;
BEGIN
    SELECT COUNT(*) INTO v_yoga_count 
    FROM event_schedules es 
    JOIN event_definitions ed ON ed.id = es.event_definition_id 
    WHERE ed.event_code = 'yoga-morning';
    
    SELECT COUNT(*) INTO v_zumba_count 
    FROM event_schedules es 
    JOIN event_definitions ed ON ed.id = es.event_definition_id 
    WHERE ed.event_code = 'zumba-morning';
    
    RAISE NOTICE 'Yoga schedules generated: %', v_yoga_count;
    RAISE NOTICE 'Zumba schedules generated: %', v_zumba_count;
END $$;

COMMIT;
