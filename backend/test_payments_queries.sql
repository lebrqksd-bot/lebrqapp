-- =====================================================
-- Test/Review Queries for Admin Payments Management System
-- =====================================================
-- These queries can be used to test and review the payments system
-- Run these queries in your MySQL database to verify the implementation

-- =====================================================
-- 1. Check if admin_settings table exists and view structure
-- =====================================================
SHOW CREATE TABLE admin_settings;

-- View all admin settings
SELECT * FROM admin_settings ORDER BY setting_key;

-- Check advance payment settings specifically
SELECT setting_key, value, updated_at 
FROM admin_settings 
WHERE setting_key LIKE 'advance_payment%'
ORDER BY setting_key;

-- =====================================================
-- 2. View payments table structure
-- =====================================================
DESCRIBE payments;

-- View all payments with related booking and user info
SELECT 
    p.id AS payment_id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    u.email AS user_email,
    p.amount,
    p.currency,
    p.provider,
    p.provider_payment_id,
    p.order_id,
    p.status,
    p.paid_at,
    p.created_at,
    p.updated_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 20;

-- =====================================================
-- 3. Test payment filtering queries (for API endpoint testing)
-- =====================================================

-- Filter by status
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    p.amount,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
WHERE p.status = 'success'
ORDER BY p.created_at DESC;

-- Filter by date range
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    p.amount,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
WHERE p.created_at >= '2024-01-01 00:00:00'
  AND p.created_at <= '2024-12-31 23:59:59'
ORDER BY p.created_at DESC;

-- Filter by booking_id
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    p.amount,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
WHERE p.booking_id = 1
ORDER BY p.created_at DESC;

-- =====================================================
-- 4. Payment statistics queries
-- =====================================================

-- Total payments by status
SELECT 
    status,
    COUNT(*) AS count,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount
FROM payments
GROUP BY status;

-- Payments by provider
SELECT 
    provider,
    COUNT(*) AS count,
    SUM(amount) AS total_amount
FROM payments
WHERE provider IS NOT NULL
GROUP BY provider;

-- Daily payment summary
SELECT 
    DATE(created_at) AS payment_date,
    COUNT(*) AS payment_count,
    SUM(amount) AS total_amount,
    COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful_payments,
    SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) AS successful_amount
FROM payments
GROUP BY DATE(created_at)
ORDER BY payment_date DESC
LIMIT 30;

-- =====================================================
-- 5. Test advance payment settings queries
-- =====================================================

-- Insert default advance payment settings (if not exists)
INSERT INTO admin_settings (setting_key, value) 
VALUES 
    ('advance_payment_enabled', 'true'),
    ('advance_payment_percentage', '50.0'),
    ('advance_payment_type', 'percentage')
ON DUPLICATE KEY UPDATE value = value;

-- Update advance payment to use fixed amount
UPDATE admin_settings 
SET value = 'fixed' 
WHERE setting_key = 'advance_payment_type';

UPDATE admin_settings 
SET value = '1000' 
WHERE setting_key = 'advance_payment_fixed_amount';

-- Disable advance payment
UPDATE admin_settings 
SET value = 'false' 
WHERE setting_key = 'advance_payment_enabled';

-- Re-enable advance payment with 30% percentage
UPDATE admin_settings 
SET value = 'true' 
WHERE setting_key = 'advance_payment_enabled';

UPDATE admin_settings 
SET value = '30.0' 
WHERE setting_key = 'advance_payment_percentage';

UPDATE admin_settings 
SET value = 'percentage' 
WHERE setting_key = 'advance_payment_type';

-- =====================================================
-- 6. Sample payment data for testing (if needed)
-- =====================================================

-- Note: These are example queries. Adjust booking_id and amounts as needed.

-- Insert a test payment (adjust booking_id to match existing booking)
-- INSERT INTO payments (
--     booking_id,
--     amount,
--     currency,
--     provider,
--     provider_payment_id,
--     order_id,
--     status,
--     created_at
-- ) VALUES (
--     1,  -- Replace with actual booking_id
--     5000.00,
--     'INR',
--     'razorpay',
--     'pay_test123',
--     'order_test123',
--     'success',
--     NOW()
-- );

-- =====================================================
-- 7. Verify payment details structure
-- =====================================================

-- View payment with full details (including JSON fields)
SELECT 
    p.id,
    p.booking_id,
    p.amount,
    p.status,
    p.details,
    p.gateway_response,
    p.created_at,
    p.updated_at
FROM payments p
WHERE p.id = 1;  -- Replace with actual payment_id

-- =====================================================
-- 8. Check pagination query structure
-- =====================================================

-- Example pagination query (page 1, 20 items per page)
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    p.amount,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 20 OFFSET 0;

-- Example pagination query (page 2, 20 items per page)
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    p.amount,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 20 OFFSET 20;

-- Get total count for pagination
SELECT COUNT(*) AS total
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id;

-- =====================================================
-- 9. Test queries for API endpoint verification
-- =====================================================

-- Query equivalent to GET /admin/payments?page=1&per_page=20&status_filter=success
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    u.email AS user_email,
    p.amount,
    p.currency,
    p.provider,
    p.provider_payment_id,
    p.order_id,
    p.status,
    p.paid_at,
    p.created_at,
    p.updated_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON b.user_id = u.id
WHERE p.status = 'success'
ORDER BY p.created_at DESC
LIMIT 20 OFFSET 0;

-- Query equivalent to GET /admin/settings/advance-payment
SELECT setting_key, value 
FROM admin_settings 
WHERE setting_key IN ('advance_payment_enabled', 'advance_payment_percentage', 'advance_payment_fixed_amount', 'advance_payment_type')
ORDER BY setting_key;

-- =====================================================
-- 10. Cleanup queries (use with caution)
-- =====================================================

-- Remove test advance payment settings (if needed)
-- DELETE FROM admin_settings WHERE setting_key LIKE 'advance_payment%';

-- Reset to default advance payment settings
-- UPDATE admin_settings SET value = 'true' WHERE setting_key = 'advance_payment_enabled';
-- UPDATE admin_settings SET value = '50.0' WHERE setting_key = 'advance_payment_percentage';
-- UPDATE admin_settings SET value = 'percentage' WHERE setting_key = 'advance_payment_type';
-- UPDATE admin_settings SET value = '0' WHERE setting_key = 'advance_payment_fixed_amount';

