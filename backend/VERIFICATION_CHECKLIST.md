# Memory Optimization Verification Checklist

## ✅ Pre-Deployment Verification

### 1. Code Review
- [x] All upload endpoints use streaming (`await file.read(CHUNK_SIZE)`)
- [x] All PDF endpoints use `StreamingResponse` with temp files
- [x] MySQL pool size reduced to 2+2
- [x] Range headers and ETag support added to file endpoints
- [x] Memory protection middleware integrated
- [x] No duplicate code in static file handler
- [x] All imports are correct

### 2. Static Analysis
- [x] No linter errors
- [x] All files compile without syntax errors
- [x] Type hints are correct (where applicable)

### 3. Dependencies
- [x] `psutil>=5.9.0` added to `requirements.txt`
- [x] All other dependencies unchanged

## 🧪 Testing Checklist

### Upload Streaming Tests

#### Test 1: Small File Upload (< 1MB)
```bash
# Should work normally
curl -X POST -F "file=@small.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/uploads/image
```
- [ ] Returns 200 OK
- [ ] File saved correctly
- [ ] Memory usage stays low (< 5MB for request)

#### Test 2: Large File Upload (10MB+)
```bash
# Create 10MB test file
dd if=/dev/zero of=test_10mb.bin bs=1M count=10

# Upload
curl -X POST -F "file=@test_10mb.bin" \
  -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/uploads/image
```
- [ ] Returns 200 OK
- [ ] File saved correctly
- [ ] Memory usage stays low (< 5MB during upload)
- [ ] No MemoryError in logs

#### Test 3: Very Large File Upload (100MB+)
```bash
# Create 100MB test file
dd if=/dev/zero of=test_100mb.bin bs=1M count=100

# Upload
curl -X POST -F "file=@test_100mb.bin" \
  -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/uploads/video
```
- [ ] Returns 200 OK (or 413 if size limit exceeded)
- [ ] Memory usage stays low (< 10MB during upload)
- [ ] No MemoryError in logs
- [ ] Server remains responsive

### PDF Streaming Tests

#### Test 4: Booking Invoice Download
```bash
# Replace 123 with actual booking ID
curl -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/bookings/123/invoice \
  --output invoice.pdf
```
- [ ] Returns 200 OK
- [ ] PDF file is valid (can open in PDF viewer)
- [ ] Memory usage stays low (< 5MB during generation)
- [ ] Temp file cleaned up after download

#### Test 5: Admin Invoice Download
```bash
# Replace 123 with actual booking ID
curl -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/admin/bookings/123/invoice \
  --output admin_invoice.pdf
```
- [ ] Returns 200 OK
- [ ] PDF file is valid
- [ ] Memory usage stays low
- [ ] Temp file cleaned up

### Range Request Tests

#### Test 6: Partial File Download (First 1MB)
```bash
curl -H "Range: bytes=0-1048575" \
  -I https://taxtower.in:8002/api/uploads/large_file.mp4
```
- [ ] Returns 206 Partial Content
- [ ] Content-Range header present
- [ ] Content-Length matches requested range
- [ ] Only requested bytes transferred

#### Test 7: Resume Download (Bytes 1MB-2MB)
```bash
curl -H "Range: bytes=1048576-2097151" \
  https://taxtower.in:8002/api/uploads/large_file.mp4 \
  --output resume.bin
```
- [ ] Returns 206 Partial Content
- [ ] Correct bytes received
- [ ] Can be appended to previous download

#### Test 8: Invalid Range Request
```bash
curl -H "Range: bytes=999999999-" \
  -I https://taxtower.in:8002/api/uploads/small_file.jpg
```
- [ ] Returns 416 Range Not Satisfiable
- [ ] Content-Range header shows file size

### ETag Caching Tests

#### Test 9: First Request (Get ETag)
```bash
curl -I https://taxtower.in:8002/api/uploads/image.jpg
```
- [ ] Returns 200 OK
- [ ] ETag header present
- [ ] Content-Length header present
- [ ] Accept-Ranges header present

#### Test 10: Cached Request (304 Not Modified)
```bash
# Get ETag from previous request
ETAG="<etag_from_previous_request>"

curl -H "If-None-Match: $ETAG" \
  -I https://taxtower.in:8002/api/uploads/image.jpg
```
- [ ] Returns 304 Not Modified
- [ ] No response body (or minimal body)
- [ ] ETag header in response

### Memory Protection Tests

#### Test 11: Memory Stats Endpoint
```bash
curl https://taxtower.in:8002/api/health/memory
```
- [ ] Returns 200 OK
- [ ] JSON response with memory stats
- [ ] Shows total, used, available RAM
- [ ] Shows status (ok/warning/critical)

#### Test 12: High Memory Scenario
```bash
# Upload multiple large files simultaneously
for i in {1..5}; do
  curl -X POST -F "file=@large_50mb.bin" \
    -H "Authorization: Bearer $TOKEN" \
    https://taxtower.in:8002/api/uploads/video &
done
wait
```
- [ ] All uploads complete successfully
- [ ] Memory usage monitored (should stay < 85%)
- [ ] No 503 errors due to memory
- [ ] Server remains responsive

### Database Pool Tests

#### Test 13: Concurrent Database Requests
```bash
# Make 20 concurrent requests
for i in {1..20}; do
  curl -H "Authorization: Bearer $TOKEN" \
    https://taxtower.in:8002/api/bookings &
done
wait
```
- [ ] All requests complete successfully
- [ ] No connection pool exhaustion errors
- [ ] Response times reasonable (< 2s)
- [ ] No "too many connections" errors

## 📊 Monitoring Checklist

### During Testing
- [ ] Monitor memory usage: `watch -n 1 'ps aux | grep uvicorn'`
- [ ] Check logs for MemoryError: `tail -f uvicorn.log | grep -i memory`
- [ ] Monitor connection pool: Check MySQL `SHOW PROCESSLIST;`
- [ ] Check disk space: `df -h` (temp files should be cleaned up)

### After Deployment
- [ ] Monitor memory for 24 hours
- [ ] Check error logs for MemoryError
- [ ] Verify no 503 errors due to memory
- [ ] Check response times (should be same or better)
- [ ] Verify file uploads work correctly
- [ ] Verify PDF generation works correctly

## 🎯 Success Criteria

### Memory Usage
- [ ] Average memory usage < 400MB (for 1GB server)
- [ ] Peak memory usage < 600MB
- [ ] No MemoryError crashes for 7 days

### Performance
- [ ] Upload speed same or better
- [ ] PDF generation time same or better
- [ ] Response times < 2s (95th percentile)
- [ ] No increase in error rate

### Stability
- [ ] Zero MemoryError crashes
- [ ] Zero 503 errors due to memory
- [ ] Connection pool stable (no exhaustion)
- [ ] Temp files cleaned up (no disk space leaks)

## 🚨 Rollback Plan

If issues occur:

1. **Disable memory protection** (temporary):
   ```python
   # In core.py, comment out:
   # app.middleware("http")(memory_protection_middleware)
   ```

2. **Restore old pool settings**:
   ```python
   # In db.py:
   POOL_SIZE = 3
   MAX_OVERFLOW = 3
   ```

3. **Revert upload endpoints** (if needed):
   - Restore `content = await file.read()` pattern
   - Remove chunked streaming

4. **Restart server**:
   ```bash
   pkill -f uvicorn
   # Start with old code
   ```

## 📝 Notes

- All tests should be run on staging first
- Monitor for at least 24 hours before production
- Keep old code in git for easy rollback
- Document any issues found during testing

