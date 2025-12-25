# Fix for 405 Method Not Allowed on Payments Admin Routes

## Issue
Getting `405 Method Not Allowed` errors when accessing:
- `GET /api/payments/admin/payments`
- `GET /api/payments/admin/settings/advance-payment`
- `POST /api/payments/admin/settings/advance-payment`

## Root Cause
The backend server is running an older version of the code that doesn't include the new admin payment routes.

## Solution

### 1. Restart the Backend Server

On your production server (`taxtower.in:8002`), restart the FastAPI backend:

```bash
# If using systemd/service
sudo systemctl restart lebrq-backend
# or
sudo service lebrq-backend restart

# If running manually
# Stop the current process (Ctrl+C or kill the process)
# Then restart:
cd /path/to/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### 2. Verify Routes Are Registered

After restarting, verify the routes are accessible:

```bash
# Test GET endpoints (replace with your admin token)
curl -X GET "https://taxtower.in:8002/api
/payments/admin/payments?page=1&per_page=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

curl -X GET "https://taxtower.in:8002/api
/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Test POST endpoint
curl -X POST "https://taxtower.in:8002/api
/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "type": "percentage",
    "percentage": 50.0,
    "fixed_amount": null
  }'
```

**Expected Response for POST:**
```json
{
  "success": true,
  "message": "Advance payment settings updated successfully",
  "settings": {
    "enabled": true,
    "type": "percentage",
    "percentage": 50.0,
    "fixed_amount": null
  }
}
```

### 3. Check Backend Logs

Check the backend logs to ensure the routes are being registered:

```bash
# Look for route registration messages
tail -f /path/to/backend/logs/app.log
# or check systemd logs
journalctl -u lebrq-backend -f
```

## Expected Routes

After restart, these routes should be available:

1. **GET** `/api/payments/admin/payments` - List all payments with pagination
2. **GET** `/api/payments/admin/settings/advance-payment` - Get advance payment settings
3. **POST** `/api/payments/admin/settings/advance-payment` - Update advance payment settings

## Quick Test Script

Save this as `test_payments_routes.sh` and run it after restarting:

```bash
#!/bin/bash
TOKEN="YOUR_ADMIN_TOKEN_HERE"
BASE_URL="https://taxtower.in:8002/api"

echo "Testing GET /payments/admin/payments..."
curl -X GET "${BASE_URL}/payments/admin/payments?page=1&per_page=5" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "Testing GET /payments/admin/settings/advance-payment..."
curl -X GET "${BASE_URL}/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "Testing POST /payments/admin/settings/advance-payment..."
curl -X POST "${BASE_URL}/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "type": "percentage", "percentage": 50.0, "fixed_amount": null}' \
  -w "\nHTTP Status: %{http_code}\n\n"
```

All requests should return `HTTP Status: 200` (not 405).

## Verification

The routes are correctly defined in:
- `backend/app/routers/payments.py` (lines 807, 898, 938)
- `backend/app/core.py` (line 227 - router is included)

If the issue persists after restart:
1. Check that the latest code is deployed on the server
2. Verify there are no reverse proxy/load balancer rules blocking these routes
3. Check CORS configuration allows requests from your frontend domain

