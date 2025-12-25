# Admin Payments Management System - API Test Examples

This document provides example API calls for testing and reviewing the payments management system.

## Base URL
```
https://taxtower.in:8002/api  (development)
https://taxtower.in:8002/api
  (production)
```

## Authentication
All admin endpoints require an admin authentication token:
```
Authorization: Bearer <admin_token>
```

---

## 1. Get All Payments (with pagination and filters)

### Endpoint
```
GET /payments/admin/payments
```

### Query Parameters
- `page` (optional, default: 1) - Page number
- `per_page` (optional, default: 20) - Items per page
- `status_filter` (optional) - Filter by status: `success`, `pending`, `failed`
- `date_from` (optional) - Filter from date (ISO format)
- `date_to` (optional) - Filter to date (ISO format)
- `booking_id` (optional) - Filter by specific booking ID

### Example Requests

#### Get first page of all payments
```bash
curl -X GET "https://taxtower.in:8002/api/payments/admin/payments?page=1&per_page=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### Get payments filtered by status
```bash
curl -X GET "https://taxtower.in:8002/api/payments/admin/payments?page=1&per_page=20&status_filter=success" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### Get payments for a specific date
```bash
curl -X GET "https://taxtower.in:8002/api/payments/admin/payments?page=1&per_page=20&date_from=2024-01-01T00:00:00Z&date_to=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### Get payments for a specific booking
```bash
curl -X GET "https://taxtower.in:8002/api/payments/admin/payments?page=1&per_page=20&booking_id=123" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Example Response
```json
{
  "success": true,
  "payments": [
    {
      "id": 1,
      "booking_id": 123,
      "booking_reference": "BK-2024-001",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "amount": 5000.0,
      "currency": "INR",
      "provider": "razorpay",
      "provider_payment_id": "pay_abc123",
      "order_id": "order_xyz789",
      "status": "success",
      "paid_at": "2024-01-15T10:30:00",
      "created_at": "2024-01-15T10:25:00",
      "updated_at": "2024-01-15T10:30:00",
      "details": {
        "total_amount": 10000.0,
        "paid_amount": 5000.0
      },
      "gateway_response": {
        "transaction_id": "txn_123456",
        "payment_method": "card"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## 2. Get Advance Payment Settings

### Endpoint
```
GET /payments/admin/settings/advance-payment
```

### Example Request
```bash
curl -X GET "https://taxtower.in:8002/api/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Example Response
```json
{
  "enabled": true,
  "percentage": 50.0,
  "fixed_amount": null,
  "type": "percentage"
}
```

#### Response when using fixed amount
```json
{
  "enabled": true,
  "percentage": null,
  "fixed_amount": 1000.0,
  "type": "fixed"
}
```

#### Response when disabled
```json
{
  "enabled": false,
  "percentage": 50.0,
  "fixed_amount": null,
  "type": "percentage"
}
```

---

## 3. Update Advance Payment Settings

### Endpoint
```
POST /payments/admin/settings/advance-payment
```

### Request Body

#### Enable with percentage (50%)
```json
{
  "enabled": true,
  "percentage": 50.0,
  "fixed_amount": null,
  "type": "percentage"
}
```

#### Enable with fixed amount
```json
{
  "enabled": true,
  "percentage": null,
  "fixed_amount": 1000.0,
  "type": "fixed"
}
```

#### Disable advance payment
```json
{
  "enabled": false,
  "percentage": 50.0,
  "fixed_amount": null,
  "type": "percentage"
}
```

#### Enable with custom percentage (30%)
```json
{
  "enabled": true,
  "percentage": 30.0,
  "fixed_amount": null,
  "type": "percentage"
}
```

### Example Request (Percentage)
```bash
curl -X POST "https://taxtower.in:8002/api/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "percentage": 50.0,
    "fixed_amount": null,
    "type": "percentage"
  }'
```

### Example Request (Fixed Amount)
```bash
curl -X POST "https://taxtower.in:8002/api/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "percentage": null,
    "fixed_amount": 1000.0,
    "type": "fixed"
  }'
```

### Example Request (Disable)
```bash
curl -X POST "https://taxtower.in:8002/api/payments/admin/settings/advance-payment" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "percentage": 50.0,
    "fixed_amount": null,
    "type": "percentage"
  }'
```

### Example Response
```json
{
  "success": true,
  "message": "Advance payment settings updated successfully",
  "settings": {
    "enabled": true,
    "percentage": 50.0,
    "fixed_amount": null,
    "type": "percentage"
  }
}
```

---

## 4. JavaScript/Fetch Examples

### Get All Payments
```javascript
const token = 'YOUR_ADMIN_TOKEN';

const response = await fetch('https://taxtower.in:8002/api/payments/admin/payments?page=1&per_page=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
console.log(data);
```

### Get Advance Payment Settings
```javascript
const token = 'YOUR_ADMIN_TOKEN';

const response = await fetch('https://taxtower.in:8002/api/payments/admin/settings/advance-payment', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const settings = await response.json();
console.log(settings);
```

### Update Advance Payment Settings
```javascript
const token = 'YOUR_ADMIN_TOKEN';

const response = await fetch('https://taxtower.in:8002/api/payments/admin/settings/advance-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    enabled: true,
    percentage: 50.0,
    fixed_amount: null,
    type: 'percentage',
  }),
});

const result = await response.json();
console.log(result);
```

---

## 5. Python Requests Examples

### Get All Payments
```python
import requests

url = "https://taxtower.in:8002/api/payments/admin/payments"
headers = {
    "Authorization": "Bearer YOUR_ADMIN_TOKEN",
    "Content-Type": "application/json"
}
params = {
    "page": 1,
    "per_page": 20,
    "status_filter": "success"
}

response = requests.get(url, headers=headers, params=params)
data = response.json()
print(data)
```

### Get Advance Payment Settings
```python
import requests

url = "https://taxtower.in:8002/api/payments/admin/settings/advance-payment"
headers = {
    "Authorization": "Bearer YOUR_ADMIN_TOKEN",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
settings = response.json()
print(settings)
```

### Update Advance Payment Settings
```python
import requests

url = "https://taxtower.in:8002/api/payments/admin/settings/advance-payment"
headers = {
    "Authorization": "Bearer YOUR_ADMIN_TOKEN",
    "Content-Type": "application/json"
}
data = {
    "enabled": True,
    "percentage": 50.0,
    "fixed_amount": None,
    "type": "percentage"
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)
```

---

## 6. Error Responses

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden (Non-admin user)
```json
{
  "detail": "Admin only"
}
```

### 400 Bad Request (Invalid settings)
```json
{
  "detail": "Percentage must be between 0 and 100"
}
```

or

```json
{
  "detail": "Fixed amount must be greater than 0"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Error listing payments: <error message>"
}
```

---

## 7. Testing Scenarios

### Scenario 1: Enable 50% Advance Payment
1. GET current settings
2. POST update with `enabled: true, percentage: 50.0, type: 'percentage'`
3. GET settings again to verify
4. Test client-side payment page - should show "Advance Payment (50%)" option

### Scenario 2: Switch to Fixed Amount
1. GET current settings
2. POST update with `enabled: true, fixed_amount: 1000.0, type: 'fixed'`
3. GET settings again to verify
4. Test client-side payment page - should show "Advance Payment (₹1,000)" option

### Scenario 3: Disable Advance Payment
1. GET current settings
2. POST update with `enabled: false`
3. GET settings again to verify
4. Test client-side payment page - should only show "Full Payment" option

### Scenario 4: Filter Payments
1. GET all payments (page 1)
2. GET payments filtered by status (success)
3. GET payments filtered by date range
4. GET payments for specific booking

---

## 8. Frontend Integration Examples

### Fetch Settings in React Component
```typescript
import { PaymentSettingsAPI } from '@/lib/api';

// In component
useEffect(() => {
  PaymentSettingsAPI.getAdvancePaymentSettings()
    .then((settings) => {
      setAdvanceSettings(settings);
      if (!settings.enabled && paymentType === 'advance') {
        setPaymentType('full');
      }
    })
    .catch((error) => {
      console.error('Error fetching settings:', error);
    });
}, []);
```

### Calculate Advance Amount
```typescript
const calculateAdvanceAmount = (totalAmount: number, settings: AdvancePaymentSettings): number => {
  if (!settings.enabled) {
    return totalAmount; // Full payment only
  }
  
  if (settings.type === 'percentage' && settings.percentage) {
    return Math.round(totalAmount * (settings.percentage / 100));
  } else if (settings.type === 'fixed' && settings.fixed_amount) {
    return Math.round(settings.fixed_amount);
  }
  
  // Fallback to 50%
  return Math.round(totalAmount * 0.5);
};
```

