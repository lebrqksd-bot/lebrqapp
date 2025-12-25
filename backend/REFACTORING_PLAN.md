# FastAPI Refactoring Plan

## Issues Identified

### 1. Large Upload Issues ❌
**Files Affected**:
- `backend/app/routers/uploads.py`:
  - `upload_poster()` - Line 127: `content = await file.read()` - loads entire file
  - `upload_image()` - Line 150: `content = await file.read()` - loads entire file  
  - `upload_video()` - Line 187: `content = await file.read()` - loads entire file
  - `upload_program_images()` - ✅ Already uses chunked reading (good!)

**Fix**: Convert all upload endpoints to use `SpooledTemporaryFile` + chunked processing

### 2. Eager Router Loading ❌
**Files Affected**:
- `backend/app/core.py`:
  - Lines 318-363: All 40+ routers imported eagerly at startup
  - Lines 373-426: All routers included immediately

**Fix**: Implement lazy router loading system

### 3. MySQL Pool Optimization ⚠️
**Files Affected**:
- `backend/app/db.py`:
  - Pool size: 3, max_overflow: 3 (good)
  - Missing: Idle connection cleanup, pool event listeners

**Fix**: Add idle connection cleanup and better event handlers

### 4. PDF Generation Memory Issues ❌
**Files Affected**:
- `backend/app/routers/bookings.py`:
  - Line 1919: `content=buffer.read()` - loads entire PDF into memory
- `backend/app/routers/admin_bookings.py`:
  - Line 3405: `content=buffer.read()` - loads entire PDF into memory
  - Line 4205: `content=buffer.read()` - loads entire PDF into memory

**Fix**: Use StreamingResponse for PDF generation

### 5. File Download Optimization ⚠️
**Files Affected**:
- `backend/app/routers/uploads.py`:
  - Uses FileResponse (good) but missing range headers and ETag support

**Fix**: Add range request support and ETag caching

## Implementation Order

1. ✅ Fix upload endpoints (highest priority - causes immediate memory issues)
2. ✅ Convert PDF generation to streaming
3. ✅ Implement lazy router loading
4. ✅ Optimize MySQL pool
5. ✅ Add range headers and ETag support


