# Running Migration Script on cPanel

This guide shows you how to run the `add_performance_team_profile_column.py` migration script on your cPanel server.

## Method 1: Using cPanel Terminal (Recommended)

### Step 1: Access Terminal
1. Log into your cPanel
2. Look for "Terminal" or "SSH Access" in your cPanel dashboard
3. Click on it to open the terminal

### Step 2: Navigate to Your Backend Directory
```bash
cd ~/public_html/backend
```
(Replace `public_html` with your actual directory name if different)

Or find your backend directory:
```bash
find ~ -name "add_performance_team_profile_column.py" -type f
```

### Step 3: Activate Virtual Environment (if using one)
If you're using a virtual environment (like `myenv`):
```bash
source myenv/bin/activate
```
or
```bash
source venv/bin/activate
```

### Step 4: Run the Migration Script
```bash
python3 add_performance_team_profile_column.py
```
or
```bash
python add_performance_team_profile_column.py
```

### Step 5: Verify Success
You should see output like:
```
Adding performance_team_profile column to items table...
Successfully added 'performance_team_profile' column to 'items' table
Migration completed!
```

---

## Method 2: Using cPanel File Manager + SSH

### Step 1: Upload the Script
1. Go to **File Manager** in cPanel
2. Navigate to your `backend` folder
3. Make sure `add_performance_team_profile_column.py` is uploaded there

### Step 2: Open Terminal
1. Go to **Terminal** in cPanel
2. Navigate to the backend directory:
   ```bash
   cd ~/public_html/backend
   ```

### Step 3: Run the Script
```bash
python3 add_performance_team_profile_column.py
```

---

## Method 3: Using SSH Client (if you have SSH access)

If you have SSH access via Putty, Terminal, or another SSH client:

```bash
# Connect to your server via SSH
ssh username@your-server-ip

# Navigate to backend directory
cd ~/public_html/backend

# Activate virtual environment (if using one)
source myenv/bin/activate  # or: source venv/bin/activate

# Run the migration
python3 add_performance_team_profile_column.py
```

---

## Method 4: Direct SQL (Alternative)

If you prefer to run the SQL directly instead of the Python script:

### Step 1: Open phpMyAdmin in cPanel
1. Log into cPanel
2. Find and click **phpMyAdmin**
3. Select your database from the left sidebar

### Step 2: Run SQL Query
1. Click on the **SQL** tab
2. Paste and run this query:

```sql
-- Check if column already exists
SELECT COUNT(*) as count
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'items'
AND COLUMN_NAME = 'performance_team_profile';

-- If count is 0, run this:
ALTER TABLE items
ADD COLUMN performance_team_profile JSON NULL
COMMENT 'Complete performance team profile: history, experience, team members, achievements, contact info, etc.'
AFTER profile_info;
```

---

## Troubleshooting

### Error: "python: command not found"
- Try `python3` instead of `python`
- Or find Python location: `which python3`

### Error: "Permission denied"
- Check file permissions: `chmod +x add_performance_team_profile_column.py`
- Or run with: `python3 add_performance_team_profile_column.py` (executable not needed)

### Error: "Module not found" or Import errors
- Make sure you're in the `backend` directory
- Make sure virtual environment is activated (if using one)
- Check Python path: `python3 -c "import sys; print(sys.path)"`

### Error: "Database connection failed"
- Verify database credentials in `.env` file or `app/core.py`
- Make sure database is accessible from your server

### Can't find the script
- List files: `ls -la ~/public_html/backend/`
- Search for it: `find ~ -name "add_performance_team_profile_column.py"`

---

## Quick Copy-Paste Commands

```bash
# Navigate to backend (adjust path as needed)
cd ~/public_html/backend

# Activate venv (if using one - uncomment the one you use)
# source myenv/bin/activate
# source venv/bin/activate

# Run migration
python3 add_performance_team_profile_column.py

# Verify column was added (optional)
python3 -c "from app.db import engine; from sqlalchemy import text; import asyncio; async def check(): async with engine.begin() as conn: result = await conn.execute(text(\"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'performance_team_profile'\")); print('Column exists!' if result.fetchone()[0] > 0 else 'Column not found'); asyncio.run(check())"
```

---

## After Running Migration

1. **Restart your Python application** in cPanel
   - Go to **Python App** or **Setup Python App**
   - Click **Restart** on your application

2. **Verify it worked:**
   - Try creating an item in the admin panel
   - Check that no more 503 errors occur

3. **If errors persist:**
   - Check backend logs
   - Verify the column exists: `DESCRIBE items;` in phpMyAdmin
   - Make sure the backend server was restarted

---

## Need Help?

If you encounter any issues:
1. Check the terminal output for error messages
2. Verify your database credentials are correct
3. Make sure you're using the correct Python version
4. Ensure the database user has `ALTER` table permissions

