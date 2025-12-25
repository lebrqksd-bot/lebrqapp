# Memory Leak & Performance Issues - Scan Report

## 🔴 CRITICAL ISSUES FOUND

### 1. **MAJOR MEMORY LEAK: Registration API Loads All Users**
**File:** `backend/app/routers/users.py` (Lines 416-432)
**Issue:** Registration endpoint loads ALL users with mobile numbers into memory to check duplicates
**Impact:** 
- If you have 10,000 users, this loads 10,000 User objects into RAM
- Each User object ~1-2KB = 10-20MB per registration request
- Under load, this can cause MemoryError
**Fix Required:** Replace with direct database query using WHERE clause

### 2. **BLOCKING OTP SERVICE: Synchronous HTTP Calls**
**File:** `backend/app/services/otp_service.py` (Line 107)
**Issue:** `send_sms_otp()` uses synchronous `http.client.HTTPConnection` which blocks event loop
**Impact:**
- Blocks entire async event loop during SMS sending
- Can cause request timeouts and memory pressure
- No retry logic
**Fix Required:** Convert to async HTTP client (httpx or aiohttp)

### 3. **BLOCKING PASSWORD HASHING: CPU-Intensive Synchronous Operation**
**File:** `backend/app/routers/users.py` (Line 453), `backend/app/routers/auth.py` (Line 283)
**Issue:** `hash_password()` is synchronous and CPU-intensive, blocks event loop
**Impact:**
- Blocks async event loop during password hashing (~100-500ms)
- Under load, causes request queuing and memory buildup
**Fix Required:** Move to thread pool with asyncio.to_thread()

### 4. **OTP STORAGE MEMORY LEAK: Unbounded In-Memory Dictionary**
**File:** `backend/app/services/otp_service.py` (Line 16)
**Issue:** `_otp_storage` dictionary grows unbounded, never cleaned up
**Impact:**
- OTPs accumulate in memory forever
- After 1000 OTP requests = 1000 entries in memory
- Memory leak over time
**Fix Required:** Add automatic cleanup of expired OTPs

### 5. **LIST USERS ENDPOINT: Loads All Users**
**File:** `backend/app/routers/users.py` (Line 38-39)
**Issue:** `/users/` endpoint loads all users without pagination
**Impact:**
- Loads entire user table into memory
- 10,000 users = 10-20MB per request
**Fix Required:** Add pagination

## ⚠️ MEDIUM PRIORITY ISSUES

### 6. **OTP Send Endpoint: ThreadPoolExecutor Overhead**
**File:** `backend/app/routers/users.py` (Line 94)
**Issue:** Uses ThreadPoolExecutor for async wrapper, but underlying function is still blocking
**Impact:** Extra overhead, could be fully async
**Fix Required:** Make OTP service fully async

### 7. **Connection Pool: Already Optimized**
**File:** `backend/app/db.py`
**Status:** ✅ Already optimized (pool_size=2, max_overflow=2)
**Note:** No changes needed

### 8. **File Uploads: Already Streaming**
**File:** `backend/app/routers/uploads.py`
**Status:** ✅ Already using streaming (chunked reads)
**Note:** No changes needed

### 9. **PDF Generation: Already Streaming**
**File:** `backend/app/routers/bookings.py`, `backend/app/routers/admin_bookings.py`
**Status:** ✅ Already using StreamingResponse
**Note:** No changes needed

## 📋 FIX PRIORITY ORDER

1. **IMMEDIATE:** Fix registration duplicate check (loads all users)
2. **HIGH:** Convert OTP service to async
3. **HIGH:** Add async password hashing
4. **MEDIUM:** Add OTP storage cleanup
5. **MEDIUM:** Add pagination to list_users endpoint

