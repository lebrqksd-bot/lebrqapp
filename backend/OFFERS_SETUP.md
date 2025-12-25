# Offers & Coupons Setup Guide

## Database Schema

All required tables and columns have been created:

### Tables Created:
1. **offers** - Festival, Birthday, and First X Users offers
2. **coupons** - Coupon codes
3. **offer_usage** - Tracks offer usage by users
4. **coupon_usage** - Tracks coupon usage by users

### Columns Added:
- **users.date_of_birth** - Required for birthday offers functionality

## Migration Scripts

### 1. `create_offers_tables.py`
Creates all offers and coupons tables if they don't exist.

**Usage:**
```bash
cd backend
python create_offers_tables.py
```

### 2. `update_offers_tables.py`
Drops and recreates all offers and coupons tables with correct structure.
**WARNING:** This will delete all existing offers and coupons data!

**Usage:**
```bash
cd backend
python update_offers_tables.py
```

### 3. `add_user_date_of_birth.py`
Adds the `date_of_birth` column to the `users` table if it doesn't exist.

**Usage:**
```bash
cd backend
python add_user_date_of_birth.py
```

### 4. `verify_offers_schema.py`
Verifies that all required columns exist in all tables.

**Usage:**
```bash
cd backend
python verify_offers_schema.py
```

## Troubleshooting

### "Database schema error: Missing column" Error

If you encounter this error:

1. **Restart the backend server** - The server may have cached the old schema
   ```bash
   # Stop the server (Ctrl+C) and restart it
   uvicorn app.main:app --reload
   ```

2. **Verify schema** - Run the verification script:
   ```bash
   python verify_offers_schema.py
   ```

3. **Recreate tables** - If columns are missing, recreate the tables:
   ```bash
   python update_offers_tables.py
   ```

4. **Check server logs** - Look for the specific column name in error messages

### Common Issues

- **Connection Pool**: If using connection pooling, old connections may have cached schema. Restart the server.
- **Production Mode**: In production, `Base.metadata.create_all()` is disabled. Use migrations instead.
- **Multiple Databases**: Ensure you're running migrations on the correct database.

## API Endpoints

### User Endpoints:
- `GET /api/offers/check` - Check applicable offers
- `POST /api/offers/apply` - Apply an offer/coupon

### Admin Endpoints:
- `GET /api/admin/offers` - List all offers
- `POST /api/admin/offers` - Create offer
- `GET /api/admin/offers/{id}` - Get single offer
- `PUT /api/admin/offers/{id}` - Update offer
- `DELETE /api/admin/offers/{id}` - Delete offer
- `GET /api/admin/offers/{id}/usage` - Get offer usage history

- `GET /api/admin/coupons` - List all coupons
- `POST /api/admin/coupons` - Create coupon
- `GET /api/admin/coupons/{id}` - Get single coupon
- `PUT /api/admin/coupons/{id}` - Update coupon
- `DELETE /api/admin/coupons/{id}` - Delete coupon
- `GET /api/admin/coupons/{id}/usage` - Get coupon usage history

## Next Steps

1. **Restart the backend server** to ensure it picks up the new schema
2. **Test the API endpoints** using the admin interface or API client
3. **Create test offers and coupons** through the admin panel
4. **Verify the offer popup** appears for users on the frontend

