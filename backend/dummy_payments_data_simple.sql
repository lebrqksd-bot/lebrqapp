-- =====================================================
-- Simple Dummy Payment Data (Fixed booking_ids)
-- =====================================================
-- This version uses fixed booking_ids that you can adjust
-- Replace the booking_id values (1, 2, 3, etc.) with actual booking IDs from your database
-- 
-- First, check your bookings table:
-- SELECT id, booking_reference FROM bookings ORDER BY id LIMIT 20;

-- =====================================================
-- Insert Dummy Payments
-- =====================================================

-- Successful Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(1, 5000.00, 'INR', 'razorpay', 'pay_rzp_001', 'order_rzp_001', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 10000.00, "paid_amount": 5000.00}', '{"transaction_id": "txn_001", "payment_method": "card"}'),
(2, 7500.00, 'INR', 'ccavenue', 'pay_cca_002', 'order_cca_002', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 15000.00, "paid_amount": 7500.00}', '{"transaction_id": "txn_002", "payment_method": "netbanking"}'),
(3, 12000.00, 'INR', 'razorpay', 'pay_rzp_003', 'order_rzp_003', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 12000.00, "paid_amount": 12000.00}', '{"transaction_id": "txn_003", "payment_method": "upi"}'),
(4, 3000.00, 'INR', 'razorpay', 'pay_rzp_004', 'order_rzp_004', 'success', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 6000.00, "paid_amount": 3000.00}', '{"transaction_id": "txn_004", "payment_method": "wallet"}'),
(5, 4500.00, 'INR', 'razorpay', 'pay_rzp_005', 'order_rzp_005', 'success', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 9000.00, "paid_amount": 4500.00}', '{"transaction_id": "txn_005", "payment_method": "card"}');

-- Pending Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(6, 6000.00, 'INR', 'razorpay', 'pay_rzp_006', 'order_rzp_006', 'pending', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 12000.00, "paid_amount": 6000.00}', NULL),
(7, 8000.00, 'INR', 'ccavenue', 'pay_cca_007', 'order_cca_007', 'pending', NULL, NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, '{"total_amount": 16000.00, "paid_amount": 8000.00}', NULL),
(8, 2500.00, 'INR', 'razorpay', 'pay_rzp_008', 'order_rzp_008', 'pending', NULL, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR, '{"total_amount": 5000.00, "paid_amount": 2500.00}', NULL);

-- Failed Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(9, 10000.00, 'INR', 'razorpay', 'pay_rzp_009', 'order_rzp_009', 'failed', NULL, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 20000.00, "paid_amount": 10000.00}', '{"error_code": "INSUFFICIENT_FUNDS", "error_description": "Insufficient funds"}'),
(10, 3500.00, 'INR', 'razorpay', 'pay_rzp_010', 'order_rzp_010', 'failed', NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 7000.00, "paid_amount": 3500.00}', '{"error_code": "CARD_DECLINED", "error_description": "Card declined by bank"}'),
(11, 5500.00, 'INR', 'ccavenue', 'pay_cca_011', 'order_cca_011', 'failed', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 11000.00, "paid_amount": 5500.00}', '{"error_code": "PAYMENT_TIMEOUT", "error_description": "Payment timeout"}');

-- Payment without booking_id (standalone)
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 2000.00, 'INR', 'razorpay', 'pay_rzp_012', 'order_rzp_012', 'success', NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, '{"total_amount": 2000.00, "paid_amount": 2000.00}', '{"transaction_id": "txn_012", "payment_method": "upi"}');

-- Different amount ranges
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(12, 500.00, 'INR', 'razorpay', 'pay_rzp_013', 'order_rzp_013', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 1000.00, "paid_amount": 500.00}', '{"transaction_id": "txn_013", "payment_method": "card"}'),
(13, 50000.00, 'INR', 'razorpay', 'pay_rzp_014', 'order_rzp_014', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 100000.00, "paid_amount": 50000.00}', '{"transaction_id": "txn_014", "payment_method": "netbanking"}'),
(14, 15000.00, 'INR', 'ccavenue', 'pay_cca_015', 'order_cca_015', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 30000.00, "paid_amount": 15000.00}', '{"transaction_id": "txn_015", "payment_method": "card"}');

-- Different dates
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(15, 4000.00, 'INR', 'razorpay', 'pay_rzp_016', 'order_rzp_016', 'success', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), '{"total_amount": 8000.00, "paid_amount": 4000.00}', '{"transaction_id": "txn_016", "payment_method": "upi"}'),
(16, 6500.00, 'INR', 'razorpay', 'pay_rzp_017', 'order_rzp_017', 'success', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), '{"total_amount": 13000.00, "paid_amount": 6500.00}', '{"transaction_id": "txn_017", "payment_method": "wallet"}'),
(17, 9000.00, 'INR', 'razorpay', 'pay_rzp_018', 'order_rzp_018', 'success', NOW(), NOW(), NOW(), '{"total_amount": 18000.00, "paid_amount": 9000.00}', '{"transaction_id": "txn_018", "payment_method": "card"}');

-- =====================================================
-- Verify the inserted data
-- =====================================================
SELECT 
    status,
    COUNT(*) AS count,
    SUM(amount) AS total_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount,
    AVG(amount) AS avg_amount
FROM payments
GROUP BY status
ORDER BY status;

