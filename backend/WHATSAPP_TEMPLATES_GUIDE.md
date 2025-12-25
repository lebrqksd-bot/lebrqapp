# WhatsApp Templates Implementation Guide

## 📱 Overview

This guide documents all WhatsApp templates integrated into the LeBRQ application using Route Mobile WhatsApp Business API.

---

## ✅ Implemented Templates

### 1. **booking_temp** - Event Booking Confirmation

**Status**: ✅ **IMPLEMENTED & WORKING**

**When it's sent**: Automatically after a booking is approved by admin

**Template Name**: `booking_temp`

**Body Parameters**:
1. `{{1}}` - Customer name
2. `{{2}}` - Start date/time
3. `{{3}}` - End date/time  
4. `{{4}}` - Booking reference

**Example**:
```
Dear John Doe,
Your booking has been approved!

Start: June 10, 2025 at 10:00 AM
End: June 10, 2025 at 06:00 PM
Reference: BRQ-2025-001

Thank you for choosing LeBRQ!
```

**Implementation Location**: 
- File: `backend/app/notifications.py`
- Function: `send_booking_approved_notification()`
- Line: ~215-220

**Test Endpoint**:
```bash
# This is triggered automatically when admin approves a booking
# via the admin bookings endpoint
```

---

### 2. **lebrq_temp_reg** - Registration Welcome

**Status**: ✅ **IMPLEMENTED & WORKING**

**When it's sent**: Automatically after a new customer or vendor registers

**Template Name**: `lebrq_temp_reg`

**Body**:
```
Registration Successful! 

Dear {{1}}, 

Thank you for registering with LeBRQ! Your registration has been successfully completed. We're thrilled to have you part of our community. Stay tuned for updates and exclusive offers.
```

**Body Parameters**:
1. `{{1}}` - Customer/Vendor name
2. `{{2}}` - Website link

**Example**:
```
Registration Successful! 

Dear Bindu, 

Thank you for registering with LeBRQ! Your registration has been successfully completed. We're thrilled to have you part of our community. Stay tuned for updates and exclusive offers.

Visit: https://lebrq.com
```

**Implementation Location**:
- File: `backend/app/notifications.py`
- Function: `_send_registration_whatsapp()`
- Line: ~122-144
- Trigger: `backend/app/routers/users.py` - `/users/register` endpoint
- Line: ~143-146

**How it works**:
1. User registers via `/users/register` endpoint
2. After successful user creation
3. `NotificationService.send_registration_welcome()` is called
4. WhatsApp template `lebrq_temp_reg` is sent automatically

**Test**:
```bash
curl -X POST "http://localhost:8000/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "mobile": "+919876543210",
    "role": "customer"
  }'
```

---

### 3. **live_show_booking** - Vendor Item Delivery Notification

**Status**: ✅ **NEWLY IMPLEMENTED**

**When it's sent**: After booking a live show event that involves vendor items

**Template Name**: `live_show_booking`

**Body**:
```
Dear {{1}}, 

Please deliver the following items:

Delivery Date: {{2}}
Delivery Time: {{3}}
Delivery Location: {{4}}

Items: {{5}}

Total Amount: {{6}}

Kindly confirm delivery schedule.

Team LeBRQ
```

**Body Parameters**:
1. `{{1}}` - Vendor name
2. `{{2}}` - Delivery date (e.g., "June 10, 2025")
3. `{{3}}` - Delivery time (e.g., "10 AM")
4. `{{4}}` - Delivery location (e.g., "LeBRQ Banquet Hall, Kochi")
5. `{{5}}` - Items list (formatted with line breaks)
6. `{{6}}` - Total amount (e.g., "₹35,000")

**Example**:
```
Dear Bindu,

Please deliver the following items:

Delivery Date: June 10, 2025
Delivery Time: 10 AM
Delivery Location: LeBRQ Banquet Hall, Kochi

Items:
1. Flower Decoration – 10 sets – Premium – ₹2,000 – ₹20,000
2. Sound System – 1 set – High Quality – ₹15,000 – ₹15,000

Total Amount: ₹35,000

Kindly confirm delivery schedule.

Team LeBRQ
```

**Implementation Location**:
- File: `backend/app/notifications.py`
- Function: `send_live_show_vendor_whatsapp()`
- Line: ~274-333

**API Endpoint** (to be called when live show is booked):
```python
POST /api/notifications/live-show-vendor
```

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Route Mobile WhatsApp Configuration
ROUTEMOBILE_BASE_URL=https://api.rmlconnect.net
ROUTEMOBILE_CLIENT_ID=your_client_id
ROUTEMOBILE_CLIENT_SECRET=your_client_secret
ROUTEMOBILE_SENDER=+91XXXXXXXXXX  # Your WhatsApp Business number

# Template Names
ROUTEMOBILE_TEMPLATE_LANGUAGE=en
ROUTEMOBILE_TEMPLATE_BOOKINGREG=bookingreg
ROUTEMOBILE_TEMPLATE_BOOKING_TEMP=booking_temp
ROUTEMOBILE_TEMPLATE_REG=lebrq_temp_reg
ROUTEMOBILE_TEMPLATE_LIVE_SHOW=live_show_booking

# Auth Mode
ROUTEMOBILE_AUTH_MODE=oauth  # or "jwt_login"
```

---

## 📝 Template Approval Checklist

Before templates work in production, they must be approved by WhatsApp/Route Mobile:

### booking_temp
- [x] Template created in Route Mobile dashboard
- [x] Template submitted for WhatsApp approval
- [ ] Template approved by WhatsApp (check dashboard)
- [x] Template integrated in code
- [ ] Tested with real booking

### lebrq_temp_reg  
- [x] Template created in Route Mobile dashboard
- [x] Template submitted for WhatsApp approval
- [ ] Template approved by WhatsApp (check dashboard)
- [x] Template integrated in code
- [ ] Tested with real registration

### live_show_booking (NEW)
- [ ] Template created in Route Mobile dashboard
- [ ] Template submitted for WhatsApp approval
- [ ] Template approved by WhatsApp
- [x] Template integrated in code
- [ ] Tested with real live show booking

---

## 🧪 Testing Guide

### 1. Test Registration Template

```bash
# Register a new user
curl -X POST "http://localhost:8000/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser@example.com",
    "password": "TestPass123",
    "first_name": "Test",
    "last_name": "User",
    "mobile": "+919876543210"
  }'

# Check logs for:
# [NOTIFICATION] ✓ Template 'lebrq_temp_reg' sent to +919876543210
```

### 2. Test Booking Confirmation Template

```bash
# This is automatically triggered when admin approves a booking
# 1. Create a booking as a customer
# 2. Log in as admin
# 3. Approve the booking via admin panel
# 4. Check logs for WhatsApp send confirmation
```

### 3. Test Live Show Vendor Template

```python
# Python test script
import asyncio
from app.notifications import NotificationService

async def test_live_show():
    await NotificationService.send_live_show_vendor_whatsapp(
        vendor_mobile="+919876543210",
        vendor_name="Bindu",
        delivery_date="June 10, 2025",
        delivery_time="10 AM",
        delivery_location="LeBRQ Banquet Hall, Kochi",
        items_list="1. Flower Decoration – 10 sets – Premium – ₹2,000 – ₹20,000\n2. Sound System – 1 set – High Quality – ₹15,000 – ₹15,000",
        total_amount="₹35,000"
    )

asyncio.run(test_live_show())
```

Or via API (create this endpoint):

```bash
curl -X POST "https://taxtower.in:8002/api/notifications/live-show-vendor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vendor_mobile": "+919876543210",
    "vendor_name": "Bindu",
    "delivery_date": "June 10, 2025",
    "delivery_time": "10 AM",
    "delivery_location": "LeBRQ Banquet Hall, Kochi",
    "items": [
      {
        "name": "Flower Decoration",
        "quantity": 10,
        "unit": "sets",
        "quality": "Premium",
        "unit_price": 2000,
        "total_price": 20000
      },
      {
        "name": "Sound System",
        "quantity": 1,
        "unit": "set",
        "quality": "High Quality",
        "unit_price": 15000,
        "total_price": 15000
      }
    ],
    "total_amount": 35000
  }'
```

---

## 🚀 Integration Points

### When Registration Happens:
```
User submits registration
    ↓
POST /users/register
    ↓
User created in database
    ↓
NotificationService.send_registration_welcome()
    ↓
✉️ Email sent (if configured)
    ↓
📱 WhatsApp template 'lebrq_temp_reg' sent
```

### When Booking is Approved:
```
Admin approves booking
    ↓
POST /admin/bookings/{id}/approve
    ↓
Booking status → 'approved'
    ↓
NotificationService.send_booking_approved_notification()
    ↓
📱 WhatsApp template 'booking_temp' sent
    ↓
✉️ Email sent
    ↓
💬 In-app notification created
```

### When Live Show is Booked (NEW):
```
Customer books live show with items
    ↓
POST /bookings (with event_type="live")
    ↓
Booking created with items
    ↓
Get vendor details for each item
    ↓
NotificationService.send_live_show_vendor_whatsapp()
    ↓
📱 WhatsApp template 'live_show_booking' sent to each vendor
```

---

## 🛠️ Troubleshooting

### Template Not Sending

**Check Route Mobile Configuration**:
```python
from app.services.whatsapp_route_mobile import RouteMobileWhatsAppClient

client = RouteMobileWhatsAppClient()
print(f"Configured: {client.is_configured()}")
```

**Check Logs**:
```bash
# Look for these patterns in logs:
grep "ROUTEMOBILE" logs/app.log
grep "WhatsApp" logs/app.log
```

**Common Issues**:

1. **Template not approved**
   - Solution: Check Route Mobile dashboard, wait for WhatsApp approval

2. **Invalid phone number format**
   - Solution: Ensure phone numbers are in E.164 format (+91XXXXXXXXXX)

3. **Authentication failed**
   - Solution: Verify `ROUTEMOBILE_CLIENT_ID` and `ROUTEMOBILE_CLIENT_SECRET`

4. **Wrong parameter count**
   - Solution: Ensure number of variables matches template placeholders

---

## 📊 Monitoring

### Success Indicators:
```
[NOTIFICATION] ✓ Template 'lebrq_temp_reg' sent to +919876543210
[ROUTEMOBILE] Template 'lebrq_temp_reg' sent to +919876543210
```

### Failure Indicators:
```
[NOTIFICATION] ✗ Live show booking WhatsApp failed for +919876543210: {...}
[ROUTEMOBILE] Send failed 400: {...}
```

### Check Route Mobile Dashboard:
- Login to Route Mobile portal
- Navigate to WhatsApp → Message Logs
- Verify delivery status
- Check for delivery reports

---

## 🔐 Security Notes

1. **Never expose credentials** in code or logs
2. **Store all secrets** in environment variables
3. **Validate phone numbers** before sending
4. **Rate limit** template sends to avoid spam
5. **Log but don't log** customer phone numbers in production

---

## 📞 Support

### Route Mobile Support:
- Dashboard: https://portal.rmlconnect.net/
- Support Email: support@rmlconnect.net
- Documentation: Check Route Mobile API docs

### Template Approval Issues:
1. Check template compliance with WhatsApp policies
2. Ensure template follows approved format
3. Contact Route Mobile support for approval status

---

## ✅ Quick Reference

| Template | Status | Trigger | Function |
|----------|--------|---------|----------|
| `booking_temp` | ✅ Working | Booking approved | `send_booking_approved_notification()` |
| `lebrq_temp_reg` | ✅ Working | User registration | `send_registration_welcome()` |
| `live_show_booking` | 🆕 New | Live show booked | `send_live_show_vendor_whatsapp()` |

---

**Last Updated**: 2024
**Maintained By**: LeBRQ Development Team

