# Vendor Order Rejection, Supply Workflow, Admin Controls & Invoice System

## ✅ Implementation Summary

This document describes the complete implementation of the vendor order management system with rejection, supply verification, payment summaries, and invoice generation.

---

## 📋 Database Changes

### New Fields Added to `booking_items` Table

1. **Rejection Fields:**
   - `rejection_status` (BOOLEAN) - Whether item was rejected by vendor
   - `rejection_note` (TEXT) - Vendor's reason for rejection
   - `rejected_at` (DATETIME) - Timestamp when item was rejected

2. **Supply Verification Fields:**
   - `supplied_at` (DATETIME) - Timestamp when vendor marked as supplied
   - `supply_verified` (BOOLEAN) - Whether admin verified the supply
   - `verified_at` (DATETIME) - Timestamp when admin verified

**Migration Script:** `backend/migrations/add_vendor_workflow_fields.sql`

---

## 🔧 Backend API Endpoints

### 1. Vendor Rejection Feature

**Endpoint:** `POST /api/vendor/orders/{booking_item_id}/reject`

**Request:**
```json
{
  "reason": "Required rejection reason text"
}
```

**Response:**
```json
{
  "ok": true,
  "status": "rejected",
  "booking_item_id": 123,
  "reason": "Out of stock"
}
```

**Features:**
- Sets `rejection_status = true`
- Stores `rejection_note` and `rejected_at`
- Notifies all admin users
- Logs status change history

---

### 2. Vendor Supply Confirmation

**Endpoint:** `POST /api/vendor/orders/{booking_item_id}/supplied`

**Response:**
```json
{
  "ok": true,
  "is_supplied": true,
  "supplied_at": "2024-01-15T10:30:00"
}
```

**Features:**
- Sets `is_supplied = true`
- Records `supplied_at` timestamp
- Notifies admin for verification

---

### 3. Admin Verify Supply

**Endpoint:** `POST /api/admin/booking-items/{booking_item_id}/verify-supply`

**Response:**
```json
{
  "ok": true,
  "booking_item_id": 123,
  "supply_verified": true,
  "verified_at": "2024-01-15T11:00:00"
}
```

**Features:**
- Verifies vendor supply
- Sets `supply_verified = true` and `verified_at`
- Only works if item is already marked as supplied

---

### 4. Admin Reassign Vendor

**Endpoint:** `POST /api/admin/booking-items/{booking_item_id}/reassign-vendor`

**Request:**
```json
{
  "vendor_id": 456
}
```

**Response:**
```json
{
  "ok": true,
  "booking_item_id": 123,
  "vendor_id": 456,
  "vendor_company": "New Vendor Co."
}
```

**Features:**
- Reassigns rejected item to new vendor
- Resets rejection status
- Sends WhatsApp notification to new vendor
- Resets booking status to 'pending'

---

### 5. Vendor Payment Summary

**Endpoint:** `GET /api/vendor/payments/summary?period=monthly&vendor_id=123`

**Query Parameters:**
- `period` (required): `weekly`, `monthly`, or `yearly`
- `vendor_id` (optional, admin only): Specific vendor ID

**Response:**
```json
{
  "period": "Monthly",
  "start_date": "2024-01-01T00:00:00",
  "end_date": "2024-01-31T23:59:59",
  "total_items": 15,
  "total_amount": 12500.50,
  "items": [
    {
      "booking_item_id": 123,
      "booking_id": 456,
      "booking_reference": "BK-2024-001",
      "item_name": "Catering Service",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00,
      "supplied_at": "2024-01-15T10:30:00",
      "verified_at": "2024-01-15T11:00:00",
      "event_date": "2024-01-20"
    }
  ]
}
```

**Features:**
- Only includes items where `is_supplied = true` AND `supply_verified = true`
- Calculates earnings for specified period
- Includes all item details for invoice generation

---

### 6. Invoice Generation

**Endpoint:** `GET /api/vendor/payments/invoice?period=monthly&format=pdf`

**Query Parameters:**
- `period` (required): `weekly`, `monthly`, or `yearly`
- `format` (required): `json` or `pdf`
- `vendor_id` (optional, admin only): Specific vendor ID

**JSON Response:**
```json
{
  "invoice_number": "INV-123-20240115120000",
  "issue_date": "2024-01-15T12:00:00",
  "vendor": {
    "company_name": "Vendor Co.",
    "contact_email": "vendor@example.com",
    "contact_phone": "+1234567890"
  },
  "period": "Monthly",
  "start_date": "2024-01-01T00:00:00",
  "end_date": "2024-01-31T23:59:59",
  "items": [...],
  "total_amount": 12500.50,
  "total_items": 15
}
```

**PDF Response:**
- Returns PDF file with professional invoice layout
- Includes company letterhead (placeholder)
- Vendor details, period, itemized table, grand total
- Downloadable filename: `invoice_{invoice_number}.pdf`

**Requirements:**
- Install `reportlab`: `pip install reportlab`

---

### 7. Invoice Sharing

#### WhatsApp Share
**Endpoint:** `POST /api/vendor/payments/invoice/share/whatsapp?period=monthly`

**Response:**
```json
{
  "ok": true,
  "message": "Invoice shared via WhatsApp"
}
```

#### Email Share
**Endpoint:** `POST /api/vendor/payments/invoice/share/email?period=monthly`

**Response:**
```json
{
  "ok": true,
  "message": "Invoice email sent"
}
```

---

## 📊 Updated Endpoints

### Vendor Orders List
**Endpoint:** `GET /api/vendor/orders`

**New Fields in Response:**
- `supplied_at` - When vendor marked as supplied
- `supply_verified` - Whether admin verified
- `verified_at` - When admin verified
- `rejection_status` - Whether item was rejected
- `rejection_note` - Rejection reason
- `rejected_at` - When item was rejected

### Admin Booking Items List
**Endpoint:** `GET /api/admin/booking-items`

**New Fields in Response:**
- `supplied_at` - Supply timestamp
- `supply_verified` - Verification status
- `verified_at` - Verification timestamp
- `rejection_status` - Rejection status
- `rejection_note` - Rejection note
- `rejected_at` - Rejection timestamp

---

## 🎨 Frontend Implementation Guide

### Vendor Orders Page Updates

1. **Add Rejection Button:**
   - Show "Reject Item" button for each order item
   - Open modal with textarea for rejection reason
   - Call `POST /api/vendor/orders/{id}/reject` with reason
   - Display rejection status and note if rejected

2. **Add Supply Button:**
   - Show "Mark as Supplied" button for non-supplied items
   - Call `POST /api/vendor/orders/{id}/supplied`
   - Update UI to show "Pending Verification" badge after supply

3. **Status Display:**
   - Show rejection badge if `rejection_status = true`
   - Show "Pending Verification" if `is_supplied = true` but `supply_verified = false`
   - Show "Verified" if `supply_verified = true`

---

### Admin Order Items Page Updates

1. **Rejection Display:**
   - Highlight rejected items (red border/badge)
   - Display rejection note in tooltip or expanded view
   - Show "Reassign Vendor" button for rejected items

2. **Verification Workflow:**
   - Show "Pending Verification" badge for supplied but unverified items
   - Add "Verify Supply" button
   - Call `POST /api/admin/booking-items/{id}/verify-supply`
   - Update badge to "Verified" after verification

3. **Reassign Vendor:**
   - Modal with vendor list dropdown
   - Call `POST /api/admin/booking-items/{id}/reassign-vendor`
   - Reset rejection status after reassignment

---

### Vendor Payment Summary Page (New)

1. **Period Selector:**
   - Dropdown: Weekly, Monthly, Yearly
   - Call `GET /api/vendor/payments/summary?period={selected}`

2. **Summary Display:**
   - Total Items count
   - Total Amount (grand total)
   - Itemized list table

3. **Invoice Generation:**
   - "Generate Invoice" button
   - Period selector
   - Options:
     - Download PDF
     - Share via WhatsApp
     - Share via Email

---

## 🔐 Authentication

- **Vendor endpoints:** Require `role = 'vendor'`
- **Admin endpoints:** Require `role = 'admin'`
- **Payment summary:** Vendors see own data, admins can view any vendor

---

## 📦 Dependencies

### Required Python Packages:
```bash
pip install reportlab  # For PDF invoice generation
```

### Existing Dependencies (Already Installed):
- FastAPI
- SQLAlchemy
- Pydantic
- JWT authentication

---

## 🚀 Setup Instructions

1. **Run Database Migration:**
   ```bash
   mysql -u root -p lebrq < backend/migrations/add_vendor_workflow_fields.sql
   ```

2. **Install PDF Dependencies:**
   ```bash
   pip install reportlab
   ```

3. **Restart Backend:**
   ```bash
   cd backend
   python -m uvicorn app.core:app --reload
   ```

---

## 📝 Notes

- All timestamps are in UTC
- Rejection reason is required (cannot be empty)
- Supply verification can only be done on items already marked as supplied
- Payment summaries only include verified supplies
- Invoice numbers are auto-generated: `INV-{vendor_id}-{timestamp}`
- WhatsApp sharing requires RouteMobile service configuration
- Email sharing requires SMTP configuration

---

## 🧪 Testing

### Test Vendor Rejection:
1. Vendor calls `POST /api/vendor/orders/{id}/reject` with reason
2. Check admin receives notification
3. Verify rejection fields in database

### Test Supply Workflow:
1. Vendor calls `POST /api/vendor/orders/{id}/supplied`
2. Admin sees "Pending Verification" badge
3. Admin calls `POST /api/admin/booking-items/{id}/verify-supply`
4. Item appears in payment summary

### Test Invoice Generation:
1. Ensure items are supplied and verified
2. Call `GET /api/vendor/payments/invoice?period=monthly&format=pdf`
3. Verify PDF downloads correctly
4. Test WhatsApp and Email sharing

---

## ✅ Implementation Status

- [x] Database schema updates
- [x] Vendor rejection endpoint
- [x] Vendor supply confirmation endpoint
- [x] Admin verify supply endpoint
- [x] Admin reassign vendor endpoint
- [x] Vendor payment summary endpoint
- [x] Invoice generation (JSON & PDF)
- [x] Invoice sharing (WhatsApp & Email)
- [x] Updated vendor orders endpoint
- [x] Updated admin booking items endpoint
- [ ] Frontend vendor orders page UI
- [ ] Frontend admin order items page UI
- [ ] Frontend payment summary page UI

---

## 📞 Support

For issues or questions, refer to:
- Backend API documentation: `/docs` endpoint
- Database schema: `backend/migrations/`
- Model definitions: `backend/app/models.py`

