# Static Files 404 Errors - Expected Behavior

## Problem
Logs show 404 errors for static files like:
- `/static/faf023af0f15d9a1.png`
- `/static/8e4318fa1c4afd95.jpg`
- `/static/ca75c861579bbf17.png`
- `/static/a9733ba4471690de.png`

## Root Cause
These 404 errors are **expected** and occur when:
1. **Old files deleted**: Files that were uploaded previously but have since been deleted from disk
2. **Database references**: The database still references these files, but they no longer exist on disk
3. **Migration issues**: Files from old upload system that weren't migrated to new location
4. **Manual deletion**: Files were manually deleted from the server but database records remain

## Current Behavior
The static file handler (`/static/{file_path}`) already:
- ✅ Checks multiple locations (uploads/, item-media/, gallery/, old locations)
- ✅ Returns efficient 404 responses with proper headers
- ✅ Logs missing files at debug level (not error level) to avoid log spam

## Solution
### Option 1: Clean Up Database (Recommended)
Remove database references to files that don't exist:

```sql
-- Find item media with missing files (example)
SELECT id, item_id, file_path, file_url 
FROM item_media 
WHERE file_path LIKE 'faf023af0f15d9a1%' 
   OR file_path LIKE '8e4318fa1c4afd95%';
```

Then either:
- Delete the database records for missing files
- Or re-upload the missing files

### Option 2: Add Default/Placeholder Images
Modify the static file handler to return a default placeholder image for missing files:

```python
# In backend/app/core.py serve_static_file function
if not file_found:
    # Return placeholder image for missing files
    placeholder_path = os.path.join(uploads_dir, "placeholder.png")
    if os.path.exists(placeholder_path):
        return FileResponse(placeholder_path, media_type="image/png")
    return Response(status_code=404, content="File not found")
```

### Option 3: Suppress 404 Logs (Already Done)
404 errors for common image files are now logged at debug level to reduce log noise.

## SSL Memory Errors
The SSL memory errors are **already handled gracefully**:
- ✅ Caught in asyncio event loop handler
- ✅ Triggers aggressive garbage collection (7 passes + gen2)
- ✅ Server continues serving other requests
- ✅ Logged at debug level to reduce noise

These errors are expected under high load with SSL connections and are automatically recovered from.

## Monitoring
To identify which files are frequently missing:

```bash
# Check logs for 404 patterns
grep "404 Not Found" /path/to/logs | grep "/static/" | sort | uniq -c | sort -rn
```

## Prevention
To prevent future 404 errors:
1. **Use soft deletes**: Mark files as deleted in database instead of deleting from disk immediately
2. **File validation**: Check file exists before saving database reference
3. **Migration script**: When migrating files, verify they exist before updating database
4. **Regular cleanup**: Periodically clean up orphaned database records

## Status
- ✅ Static file handler checks multiple locations
- ✅ 404 responses are efficient
- ✅ SSL memory errors handled gracefully
- ✅ Logging optimized to reduce noise
- ⚠️ Some 404 errors are expected for old/deleted files

