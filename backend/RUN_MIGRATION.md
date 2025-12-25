# Add scan_count Column Migration

## Issue
The `program_participants` table is missing the `scan_count` column, causing errors:
```
Unknown column 'program_participants.scan_count' in 'field list'
```

## Solution

### Option 1: Run the Python Migration Script
```bash
cd backend
python add_scan_count_column.py
```

### Option 2: Run SQL Directly in MySQL

Connect to your MySQL database and run:

```sql
-- Check if column exists
SHOW COLUMNS FROM program_participants LIKE 'scan_count';

-- If it doesn't exist, add it:
ALTER TABLE program_participants
ADD COLUMN scan_count INT DEFAULT 0 NOT NULL;

-- Verify it was added
DESCRIBE program_participants;
```

### Option 3: For MySQL versions that don't support IF NOT EXISTS

If you get an error that the column already exists, that's fine - it means it's already there.

## After Migration

1. Restart your FastAPI server
2. The errors should be resolved
3. The `scan_count` column will default to 0 for all existing records

## Note

The model has been updated to make `scan_count` nullable as a temporary workaround, but you should still add the column to the database for proper functionality.

