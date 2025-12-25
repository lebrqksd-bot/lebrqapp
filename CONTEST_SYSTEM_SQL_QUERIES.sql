-- ============================================
-- SQL QUERIES FOR CONTEST SYSTEM TABLES
-- ============================================
-- These queries show the structure of tables and columns
-- added for the contest/offers system

-- ============================================
-- 1. LIST ALL CONTEST-RELATED TABLES
-- ============================================
-- SQLite:
SELECT name FROM sqlite_master 
WHERE type='table' 
AND name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY name;

-- PostgreSQL:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contests', 'contest_entry_files', 'contest_entries', 'contest_notifications', 'user_event_dates')
ORDER BY table_name;

-- MySQL:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = DATABASE()
AND table_name IN ('contests', 'contest_entry_files', 'contest_entries', 'contest_notifications', 'user_event_dates')
ORDER BY table_name;


-- ============================================
-- 2. SHOW TABLE STRUCTURE - CONTESTS
-- ============================================
-- SQLite:
PRAGMA table_info(contests);

-- PostgreSQL:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contests'
ORDER BY ordinal_position;

-- MySQL:
DESCRIBE contests;
-- OR
SHOW COLUMNS FROM contests;


-- ============================================
-- 3. SHOW TABLE STRUCTURE - CONTEST_ENTRIES
-- ============================================
-- SQLite:
PRAGMA table_info(contest_entries);

-- PostgreSQL:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contest_entries'
ORDER BY ordinal_position;

-- MySQL:
DESCRIBE contest_entries;


-- ============================================
-- 4. SHOW TABLE STRUCTURE - CONTEST_ENTRY_FILES
-- ============================================
-- SQLite:
PRAGMA table_info(contest_entry_files);

-- PostgreSQL:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contest_entry_files'
ORDER BY ordinal_position;

-- MySQL:
DESCRIBE contest_entry_files;


-- ============================================
-- 5. SHOW TABLE STRUCTURE - CONTEST_NOTIFICATIONS
-- ============================================
-- SQLite:
PRAGMA table_info(contest_notifications);

-- PostgreSQL:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contest_notifications'
ORDER BY ordinal_position;

-- MySQL:
DESCRIBE contest_notifications;


-- ============================================
-- 6. SHOW TABLE STRUCTURE - USER_EVENT_DATES
-- ============================================
-- SQLite:
PRAGMA table_info(user_event_dates);

-- PostgreSQL:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_event_dates'
ORDER BY ordinal_position;

-- MySQL:
DESCRIBE user_event_dates;


-- ============================================
-- 7. CREATE TABLE STATEMENTS (SQLite)
-- ============================================
-- These show the exact CREATE TABLE statements

-- SQLite:
SELECT sql FROM sqlite_master 
WHERE type='table' 
AND name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY name;


-- ============================================
-- 8. GET ALL COLUMNS WITH DETAILS (PostgreSQL)
-- ============================================
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END AS is_primary_key,
    CASE 
        WHEN fk.column_name IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END AS is_foreign_key
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
AND t.table_name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY t.table_name, c.ordinal_position;


-- ============================================
-- 9. GET FOREIGN KEY RELATIONSHIPS
-- ============================================
-- PostgreSQL:
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY tc.table_name, kcu.column_name;

-- MySQL:
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME,
    CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;


-- ============================================
-- 10. GET INDEXES
-- ============================================
-- SQLite:
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type='index' 
AND tbl_name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY tbl_name, name;

-- PostgreSQL:
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY tablename, indexname;

-- MySQL:
SHOW INDEXES FROM contests;
SHOW INDEXES FROM contest_entries;
SHOW INDEXES FROM contest_entry_files;
SHOW INDEXES FROM contest_notifications;
SHOW INDEXES FROM user_event_dates;


-- ============================================
-- 11. COUNT RECORDS IN EACH TABLE
-- ============================================
SELECT 'contests' AS table_name, COUNT(*) AS record_count FROM contests
UNION ALL
SELECT 'contest_entries', COUNT(*) FROM contest_entries
UNION ALL
SELECT 'contest_entry_files', COUNT(*) FROM contest_entry_files
UNION ALL
SELECT 'contest_notifications', COUNT(*) FROM contest_notifications
UNION ALL
SELECT 'user_event_dates', COUNT(*) FROM user_event_dates
ORDER BY table_name;


-- ============================================
-- 12. DETAILED COLUMN INFORMATION (All Tables)
-- ============================================
-- SQLite - Get all columns with types:
SELECT 
    m.name AS table_name,
    p.name AS column_name,
    p.type AS data_type,
    p."notnull" AS is_not_null,
    p.dflt_value AS default_value,
    p.pk AS is_primary_key
FROM sqlite_master m
JOIN pragma_table_info(m.name) p
WHERE m.type = 'table'
AND m.name IN ('contests', 'contest_entries', 'contest_entry_files', 'contest_notifications', 'user_event_dates')
ORDER BY m.name, p.cid;


-- ============================================
-- EXPECTED TABLE STRUCTURES
-- ============================================

-- CONTESTS TABLE:
-- - id (INTEGER, PRIMARY KEY)
-- - title (VARCHAR(200), NOT NULL)
-- - slug (VARCHAR(100), UNIQUE, NOT NULL, INDEXED)
-- - description (TEXT, NULLABLE)
-- - hero_image_url (VARCHAR(500), NULLABLE)
-- - banner_image_url (VARCHAR(500), NULLABLE)
-- - start_date (DATE, NOT NULL, INDEXED)
-- - end_date (DATE, NOT NULL, INDEXED)
-- - applicable_event_types (JSON, NULLABLE)
-- - first_x_winners (INTEGER, NULLABLE)
-- - eligibility_criteria (TEXT, NULLABLE)
-- - per_user_limit (INTEGER, DEFAULT 1)
-- - auto_approve (BOOLEAN, DEFAULT FALSE)
-- - prizes (JSON, NULLABLE)
-- - is_published (BOOLEAN, DEFAULT FALSE, INDEXED)
-- - created_by_user_id (INTEGER, FOREIGN KEY -> users.id, NULLABLE)
-- - created_at (DATETIME, DEFAULT NOW)
-- - updated_at (DATETIME, DEFAULT NOW, ON UPDATE NOW)

-- CONTEST_ENTRIES TABLE:
-- - id (INTEGER, PRIMARY KEY)
-- - contest_id (INTEGER, FOREIGN KEY -> contests.id, NOT NULL, INDEXED)
-- - participant_name (VARCHAR(200), NOT NULL)
-- - email (VARCHAR(255), NULLABLE, INDEXED)
-- - phone (VARCHAR(32), NULLABLE, INDEXED)
-- - event_type (VARCHAR(50), NOT NULL)
-- - event_date (DATE, NOT NULL, INDEXED)
-- - relation (VARCHAR(50), DEFAULT 'self')
-- - booking_id (INTEGER, FOREIGN KEY -> bookings.id, NULLABLE)
-- - message (TEXT, NULLABLE)
-- - owner_email (VARCHAR(255), NULLABLE, INDEXED)
-- - owner_phone (VARCHAR(32), NULLABLE, INDEXED)
-- - status (VARCHAR(50), DEFAULT 'pending', INDEXED)
-- - admin_note (TEXT, NULLABLE)
-- - ocr_confidence (FLOAT, NULLABLE)
-- - ocr_date_matches (BOOLEAN, NULLABLE)
-- - ocr_extracted_text (TEXT, NULLABLE)
-- - reference_id (VARCHAR(50), UNIQUE, NOT NULL, INDEXED)
-- - ip_address (VARCHAR(45), NULLABLE)
-- - created_at (DATETIME, DEFAULT NOW)
-- - updated_at (DATETIME, DEFAULT NOW, ON UPDATE NOW)
-- - approved_at (DATETIME, NULLABLE)
-- - marked_winner_at (DATETIME, NULLABLE)

-- CONTEST_ENTRY_FILES TABLE:
-- - id (INTEGER, PRIMARY KEY)
-- - entry_id (INTEGER, FOREIGN KEY -> contest_entries.id, NOT NULL, INDEXED)
-- - file_name (VARCHAR(255), NOT NULL)
-- - file_url (VARCHAR(500), NOT NULL)
-- - file_type (VARCHAR(100), NOT NULL)
-- - file_size (INTEGER, NULLABLE)
-- - uploaded_at (DATETIME, DEFAULT NOW)

-- CONTEST_NOTIFICATIONS TABLE:
-- - id (INTEGER, PRIMARY KEY)
-- - entry_id (INTEGER, FOREIGN KEY -> contest_entries.id, NOT NULL, INDEXED)
-- - channel (VARCHAR(50), NOT NULL) -- 'email' or 'whatsapp'
-- - recipient_email (VARCHAR(255), NULLABLE)
-- - recipient_phone (VARCHAR(32), NULLABLE)
-- - subject (VARCHAR(500), NULLABLE)
-- - message_body (TEXT, NOT NULL)
-- - sent_by_user_id (INTEGER, FOREIGN KEY -> users.id, NULLABLE)
-- - status (VARCHAR(50), DEFAULT 'pending') -- 'pending', 'sent', 'failed'
-- - error_message (TEXT, NULLABLE)
-- - provider_response (JSON, NULLABLE)
-- - sent_at (DATETIME, NULLABLE)
-- - created_at (DATETIME, DEFAULT NOW)

-- USER_EVENT_DATES TABLE:
-- - id (INTEGER, PRIMARY KEY)
-- - person_name (VARCHAR(200), NOT NULL)
-- - event_type (VARCHAR(50), NOT NULL) -- 'birthday', 'anniversary', 'other'
-- - event_date (DATE, NOT NULL, INDEXED)
-- - relation (VARCHAR(50), DEFAULT 'self') -- 'self', 'family', 'friend'
-- - email (VARCHAR(255), NULLABLE, INDEXED)
-- - phone (VARCHAR(32), NULLABLE, INDEXED)
-- - notify_on_offers (BOOLEAN, DEFAULT TRUE)
-- - created_at (DATETIME, DEFAULT NOW)
-- - updated_at (DATETIME, DEFAULT NOW, ON UPDATE NOW)

