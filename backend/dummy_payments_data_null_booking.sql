-- =====================================================
-- Dummy Payment Data (All with NULL booking_id)
-- =====================================================
-- This version uses NULL for all booking_ids to avoid foreign key constraint errors
-- Perfect for testing the payments table without needing existing bookings
-- 
-- NOTE: booking_id is nullable in the payments table, so this is safe!

-- =====================================================
-- Insert Dummy Payments (All with NULL booking_id)
-- =====================================================

-- Successful Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 5000.00, 'INR', 'razorpay', 'pay_rzp_001', 'order_rzp_001', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 10000.00, "paid_amount": 5000.00}', '{"transaction_id": "txn_001", "payment_method": "card"}'),
(NULL, 7500.00, 'INR', 'ccavenue', 'pay_cca_002', 'order_cca_002', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 15000.00, "paid_amount": 7500.00}', '{"transaction_id": "txn_002", "payment_method": "netbanking"}'),
(NULL, 12000.00, 'INR', 'razorpay', 'pay_rzp_003', 'order_rzp_003', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 12000.00, "paid_amount": 12000.00}', '{"transaction_id": "txn_003", "payment_method": "upi"}'),
(NULL, 3000.00, 'INR', 'razorpay', 'pay_rzp_004', 'order_rzp_004', 'success', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 6000.00, "paid_amount": 3000.00}', '{"transaction_id": "txn_004", "payment_method": "wallet"}'),
(NULL, 4500.00, 'INR', 'razorpay', 'pay_rzp_005', 'order_rzp_005', 'success', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 9000.00, "paid_amount": 4500.00}', '{"transaction_id": "txn_005", "payment_method": "card"}'),
(NULL, 8500.00, 'INR', 'razorpay', 'pay_rzp_006', 'order_rzp_006', 'success', NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, '{"total_amount": 17000.00, "paid_amount": 8500.00}', '{"transaction_id": "txn_006", "payment_method": "upi"}'),
(NULL, 2200.00, 'INR', 'ccavenue', 'pay_cca_007', 'order_cca_007', 'success', NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR, '{"total_amount": 4400.00, "paid_amount": 2200.00}', '{"transaction_id": "txn_007", "payment_method": "netbanking"}');

-- Pending Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 6000.00, 'INR', 'razorpay', 'pay_rzp_008', 'order_rzp_008', 'pending', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 12000.00, "paid_amount": 6000.00}', NULL),
(NULL, 8000.00, 'INR', 'ccavenue', 'pay_cca_009', 'order_cca_009', 'pending', NULL, NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, '{"total_amount": 16000.00, "paid_amount": 8000.00}', NULL),
(NULL, 2500.00, 'INR', 'razorpay', 'pay_rzp_010', 'order_rzp_010', 'pending', NULL, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR, '{"total_amount": 5000.00, "paid_amount": 2500.00}', NULL),
(NULL, 11000.00, 'INR', 'razorpay', 'pay_rzp_011', 'order_rzp_011', 'pending', NULL, NOW() - INTERVAL 30 MINUTE, NOW() - INTERVAL 30 MINUTE, '{"total_amount": 22000.00, "paid_amount": 11000.00}', NULL);

-- Failed Payments
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 10000.00, 'INR', 'razorpay', 'pay_rzp_012', 'order_rzp_012', 'failed', NULL, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 20000.00, "paid_amount": 10000.00}', '{"error_code": "INSUFFICIENT_FUNDS", "error_description": "Insufficient funds in account", "error_reason": "payment_failed"}'),
(NULL, 3500.00, 'INR', 'razorpay', 'pay_rzp_013', 'order_rzp_013', 'failed', NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, '{"total_amount": 7000.00, "paid_amount": 3500.00}', '{"error_code": "CARD_DECLINED", "error_description": "Card declined by bank", "error_reason": "payment_failed"}'),
(NULL, 5500.00, 'INR', 'ccavenue', 'pay_cca_014', 'order_cca_014', 'failed', NULL, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, '{"total_amount": 11000.00, "paid_amount": 5500.00}', '{"error_code": "PAYMENT_TIMEOUT", "error_description": "Payment timeout", "error_reason": "payment_failed"}'),
(NULL, 7200.00, 'INR', 'razorpay', 'pay_rzp_015', 'order_rzp_015', 'failed', NULL, NOW() - INTERVAL 8 HOUR, NOW() - INTERVAL 8 HOUR, '{"total_amount": 14400.00, "paid_amount": 7200.00}', '{"error_code": "NETWORK_ERROR", "error_description": "Network connection failed", "error_reason": "payment_failed"}');

-- Different amount ranges
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 500.00, 'INR', 'razorpay', 'pay_rzp_016', 'order_rzp_016', 'success', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, '{"total_amount": 1000.00, "paid_amount": 500.00}', '{"transaction_id": "txn_016", "payment_method": "card"}'),
(NULL, 50000.00, 'INR', 'razorpay', 'pay_rzp_017', 'order_rzp_017', 'success', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY, '{"total_amount": 100000.00, "paid_amount": 50000.00}', '{"transaction_id": "txn_017", "payment_method": "netbanking", "bank_name": "State Bank of India"}'),
(NULL, 15000.00, 'INR', 'ccavenue', 'pay_cca_018', 'order_cca_018', 'success', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, '{"total_amount": 30000.00, "paid_amount": 15000.00}', '{"transaction_id": "txn_018", "payment_method": "card", "card_last4": "1234"}'),
(NULL, 25000.00, 'INR', 'razorpay', 'pay_rzp_019', 'order_rzp_019', 'success', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '{"total_amount": 50000.00, "paid_amount": 25000.00}', '{"transaction_id": "txn_019", "payment_method": "upi", "upi_id": "customer@paytm"}');

-- Different dates (for date filtering testing)
INSERT INTO payments (booking_id, amount, currency, provider, provider_payment_id, order_id, status, paid_at, created_at, updated_at, details, gateway_response) VALUES
(NULL, 4000.00, 'INR', 'razorpay', 'pay_rzp_020', 'order_rzp_020', 'success', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), '{"total_amount": 8000.00, "paid_amount": 4000.00}', '{"transaction_id": "txn_020", "payment_method": "upi"}'),
(NULL, 6500.00, 'INR', 'razorpay', 'pay_rzp_021', 'order_rzp_021', 'success', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), '{"total_amount": 13000.00, "paid_amount": 6500.00}', '{"transaction_id": "txn_021", "payment_method": "wallet", "wallet": "paytm"}'),
(NULL, 9000.00, 'INR', 'razorpay', 'pay_rzp_022', 'order_rzp_022', 'success', NOW(), NOW(), NOW(), '{"total_amount": 18000.00, "paid_amount": 9000.00}', '{"transaction_id": "txn_022", "payment_method": "card", "card_last4": "5678"}'),
(NULL, 1800.00, 'INR', 'ccavenue', 'pay_cca_023', 'order_cca_023', 'success', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), '{"total_amount": 3600.00, "paid_amount": 1800.00}', '{"transaction_id": "txn_023", "payment_method": "netbanking", "bank_name": "HDFC Bank"}');

-- =====================================================
-- Verify the inserted data
-- =====================================================

-- Summary by status
SELECT 
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

-- Summary by provider
SELECT 
    provider,
    COUNT(*) AS count,
    SUM(amount) AS total_amount
FROM payments
WHERE (provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%')
  AND provider IS NOT NULL
GROUP BY provider
ORDER BY provider;

-- View all inserted payments
SELECT 
    id,
    booking_id,
    amount,
    currency,
    provider,
    status,
    created_at,
    paid_at,
    order_id
FROM payments
WHERE provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%'
ORDER BY created_at DESC;

-- Count total inserted
SELECT 
    COUNT(*) AS total_payments_inserted
FROM payments
WHERE provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%';

