-- =====================================================
-- Safe Dummy Payment Data (Auto-detects booking_ids)
-- =====================================================
-- This version automatically uses existing booking_ids or NULL if none exist
-- No foreign key constraint errors!

-- =====================================================
-- Step 1: Check existing bookings
-- =====================================================
SELECT 
    'Available Bookings:' AS info,
    id AS booking_id,
    booking_reference,
    total_amount
FROM bookings 
ORDER BY id 
LIMIT 20;

-- =====================================================
-- Step 2: Insert Dummy Payments (using existing booking_ids or NULL)
-- =====================================================

-- Get the first available booking_id (or NULL if none exist)
SET @first_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1);
SET @second_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 1);
SET @third_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 2);
SET @fourth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 3);
SET @fifth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 4);
SET @sixth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 5);
SET @seventh_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 6);
SET @eighth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 7);
SET @ninth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 8);
SET @tenth_booking_id = (SELECT id FROM bookings ORDER BY id LIMIT 1 OFFSET 9);

-- Successful Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(@first_booking_id, 5000.00, 'INR', 'razorpay', 'pay_rzp_001', 'order_rzp_001', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 10000.00, "paid_amount": 5000.00}', '{"transaction_id": "txn_001", "payment_method": "card"}'),
(@second_booking_id, 7500.00, 'INR', 'ccavenue', 'pay_cca_002', 'order_cca_002', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 15000.00, "paid_amount": 7500.00}', '{"transaction_id": "txn_002", "payment_method": "netbanking"}'),
(@third_booking_id, 12000.00, 'INR', 'razorpay', 'pay_rzp_003', 'order_rzp_003', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 12000.00, "paid_amount": 12000.00}', '{"transaction_id": "txn_003", "payment_method": "upi"}'),
(@fourth_booking_id, 3000.00, 'INR', 'razorpay', 'pay_rzp_004', 'order_rzp_004', 'success', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 6000.00, "paid_amount": 3000.00}', '{"transaction_id": "txn_004", "payment_method": "wallet"}'),
(@fifth_booking_id, 4500.00, 'INR', 'razorpay', 'pay_rzp_005', 'order_rzp_005', 'success', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 9000.00, "paid_amount": 4500.00}', '{"transaction_id": "txn_005", "payment_method": "card"}');

-- Pending Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(@sixth_booking_id, 6000.00, 'INR', 'razorpay', 'pay_rzp_006', 'order_rzp_006', 'pending', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 12000.00, "paid_amount": 6000.00}', NULL),
(@seventh_booking_id, 8000.00, 'INR', 'ccavenue', 'pay_cca_007', 'order_cca_007', 'pending', NULL, NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, '{"total_amount": 16000.00, "paid_amount": 8000.00}', NULL),
(@eighth_booking_id, 2500.00, 'INR', 'razorpay', 'pay_rzp_008', 'order_rzp_008', 'pending', NULL, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR, '{"total_amount": 5000.00, "paid_amount": 2500.00}', NULL);

-- Failed Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(@ninth_booking_id, 10000.00, 'INR', 'razorpay', 'pay_rzp_009', 'order_rzp_009', 'failed', NULL, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 20000.00, "paid_amount": 10000.00}', '{"error_code": "INSUFFICIENT_FUNDS", "error_description": "Insufficient funds"}'),
(@tenth_booking_id, 3500.00, 'INR', 'razorpay', 'pay_rzp_010', 'order_rzp_010', 'failed', NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 7000.00, "paid_amount": 3500.00}', '{"error_code": "CARD_DECLINED", "error_description": "Card declined by bank"}'),
(NULL, 5500.00, 'INR', 'ccavenue', 'pay_cca_011', 'order_cca_011', 'failed', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 11000.00, "paid_amount": 5500.00}', '{"error_code": "PAYMENT_TIMEOUT", "error_description": "Payment timeout"}');

-- Payment without booking_id (standalone)
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 2000.00, 'INR', 'razorpay', 'pay_rzp_012', 'order_rzp_012', 'success', NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, '{"total_amount": 2000.00, "paid_amount": 2000.00}', '{"transaction_id": "txn_012", "payment_method": "upi"}');

-- Different amount ranges (all with NULL booking_id to avoid foreign key issues)
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 500.00, 'INR', 'razorpay', 'pay_rzp_013', 'order_rzp_013', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 1000.00, "paid_amount": 500.00}', '{"transaction_id": "txn_013", "payment_method": "card"}'),
(NULL, 50000.00, 'INR', 'razorpay', 'pay_rzp_014', 'order_rzp_014', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 100000.00, "paid_amount": 50000.00}', '{"transaction_id": "txn_014", "payment_method": "netbanking"}'),
(NULL, 15000.00, 'INR', 'ccavenue', 'pay_cca_015', 'order_cca_015', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 30000.00, "paid_amount": 15000.00}', '{"transaction_id": "txn_015", "payment_method": "card"}');

-- Different dates (all with NULL booking_id)
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 4000.00, 'INR', 'razorpay', 'pay_rzp_016', 'order_rzp_016', 'success', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), '{"total_amount": 8000.00, "paid_amount": 4000.00}', '{"transaction_id": "txn_016", "payment_method": "upi"}'),
(NULL, 6500.00, 'INR', 'razorpay', 'pay_rzp_017', 'order_rzp_017', 'success', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), '{"total_amount": 13000.00, "paid_amount": 6500.00}', '{"transaction_id": "txn_017", "payment_method": "wallet"}'),
(NULL, 9000.00, 'INR', 'razorpay', 'pay_rzp_018', 'order_rzp_018', 'success', NOW(), NOW(), NOW(), '{"total_amount": 18000.00, "paid_amount": 9000.00}', '{"transaction_id": "txn_018", "payment_method": "card"}');

-- =====================================================
-- Step 3: Verify the inserted data
-- =====================================================
SELECT 
    'Payment Summary:' AS info,
    status,
    COUNT(*) AS count,
    SUM(amount) AS total_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount,
    ROUND(AVG(amount), 2) AS avg_amount
FROM payments
WHERE provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%'
GROUP BY status
ORDER BY status;

-- View all inserted payments
SELECT 
    id,
    booking_id,
    amount,
    currency,
    provider,
    status,
    created_at,
    paid_at
FROM payments
WHERE provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%'
ORDER BY created_at DESC;

