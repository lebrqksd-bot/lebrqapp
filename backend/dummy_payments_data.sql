-- =====================================================
-- Dummy Payment Data for Testing
-- =====================================================
-- This file contains INSERT statements for dummy payment data
-- Run these queries in your MySQL database to populate the payments table for testing
-- 
-- NOTE: Make sure you have corresponding booking_ids in your bookings table
-- Adjust booking_id values to match your actual bookings

-- =====================================================
-- 1. Check existing bookings to get valid booking_ids
-- =====================================================
-- Run this first to see available booking_ids:
-- SELECT id, booking_reference, user_id, total_amount, status FROM bookings ORDER BY id LIMIT 10;

-- =====================================================
-- 2. Insert Dummy Payments (Success Status)
-- =====================================================

-- Payment 1: Successful Razorpay payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1),  -- Use first available booking
    5000.00,
    'INR',
    'razorpay',
    'pay_abc123xyz456',
    'order_rzp_20240115_001',
    'success',
    NOW() - INTERVAL 5 DAY,
    NOW() - INTERVAL 5 DAY,
    NOW() - INTERVAL 5 DAY,
    JSON_OBJECT(
        'total_amount', 10000.00,
        'paid_amount', 5000.00,
        'base_amount', 8000.00,
        'addons_amount', 1500.00,
        'transport_amount', 500.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_rzp_abc123',
        'payment_method', 'card',
        'card_last4', '4242',
        'bank', 'HDFC Bank'
    )
);

-- Payment 2: Successful CCAvenue payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 1),  -- Use second available booking
    7500.00,
    'INR',
    'ccavenue',
    'pay_cca_789def456',
    'order_cca_20240116_002',
    'success',
    NOW() - INTERVAL 4 DAY,
    NOW() - INTERVAL 4 DAY,
    NOW() - INTERVAL 4 DAY,
    JSON_OBJECT(
        'total_amount', 15000.00,
        'paid_amount', 7500.00,
        'base_amount', 12000.00,
        'addons_amount', 2500.00,
        'transport_amount', 500.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_cca_789def',
        'payment_method', 'netbanking',
        'bank_name', 'ICICI Bank',
        'payment_mode', 'NB'
    )
);

-- Payment 3: Successful full payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 2),  -- Use third available booking
    12000.00,
    'INR',
    'razorpay',
    'pay_rzp_full_999',
    'order_rzp_20240117_003',
    'success',
    NOW() - INTERVAL 3 DAY,
    NOW() - INTERVAL 3 DAY,
    NOW() - INTERVAL 3 DAY,
    JSON_OBJECT(
        'total_amount', 12000.00,
        'paid_amount', 12000.00,
        'base_amount', 10000.00,
        'addons_amount', 2000.00,
        'transport_amount', 0.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_rzp_full_999',
        'payment_method', 'upi',
        'upi_id', 'user@paytm'
    )
);

-- Payment 4: Successful payment with UPI
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 3),
    3000.00,
    'INR',
    'razorpay',
    'pay_rzp_upi_111',
    'order_rzp_20240118_004',
    'success',
    NOW() - INTERVAL 2 DAY,
    NOW() - INTERVAL 2 DAY,
    NOW() - INTERVAL 2 DAY,
    JSON_OBJECT(
        'total_amount', 6000.00,
        'paid_amount', 3000.00,
        'base_amount', 5000.00,
        'addons_amount', 1000.00,
        'transport_amount', 0.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_rzp_upi_111',
        'payment_method', 'upi',
        'upi_id', 'customer@phonepe',
        'vpa', 'customer@phonepe'
    )
);

-- Payment 5: Successful payment with wallet
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 4),
    4500.00,
    'INR',
    'razorpay',
    'pay_rzp_wallet_222',
    'order_rzp_20240119_005',
    'success',
    NOW() - INTERVAL 1 DAY,
    NOW() - INTERVAL 1 DAY,
    NOW() - INTERVAL 1 DAY,
    JSON_OBJECT(
        'total_amount', 9000.00,
        'paid_amount', 4500.00,
        'base_amount', 7000.00,
        'addons_amount', 1500.00,
        'transport_amount', 500.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_rzp_wallet_222',
        'payment_method', 'wallet',
        'wallet', 'paytm'
    )
);

-- =====================================================
-- 3. Insert Dummy Payments (Pending Status)
-- =====================================================

-- Payment 6: Pending payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 5),
    6000.00,
    'INR',
    'razorpay',
    'pay_rzp_pending_333',
    'order_rzp_20240120_006',
    'pending',
    NULL,
    NOW() - INTERVAL 12 HOUR,
    NOW() - INTERVAL 12 HOUR,
    JSON_OBJECT(
        'total_amount', 12000.00,
        'paid_amount', 6000.00,
        'base_amount', 10000.00,
        'addons_amount', 2000.00,
        'transport_amount', 0.00
    ),
    NULL
);

-- Payment 7: Pending CCAvenue payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 6),
    8000.00,
    'INR',
    'ccavenue',
    'pay_cca_pending_444',
    'order_cca_20240120_007',
    'pending',
    NULL,
    NOW() - INTERVAL 6 HOUR,
    NOW() - INTERVAL 6 HOUR,
    JSON_OBJECT(
        'total_amount', 16000.00,
        'paid_amount', 8000.00,
        'base_amount', 14000.00,
        'addons_amount', 2000.00,
        'transport_amount', 0.00
    ),
    NULL
);

-- Payment 8: Pending payment (just created)
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 7),
    2500.00,
    'INR',
    'razorpay',
    'pay_rzp_pending_555',
    'order_rzp_20240121_008',
    'pending',
    NULL,
    NOW() - INTERVAL 1 HOUR,
    NOW() - INTERVAL 1 HOUR,
    JSON_OBJECT(
        'total_amount', 5000.00,
        'paid_amount', 2500.00,
        'base_amount', 4000.00,
        'addons_amount', 1000.00,
        'transport_amount', 0.00
    ),
    NULL
);

-- =====================================================
-- 4. Insert Dummy Payments (Failed Status)
-- =====================================================

-- Payment 9: Failed payment (insufficient funds)
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 8),
    10000.00,
    'INR',
    'razorpay',
    'pay_rzp_failed_666',
    'order_rzp_20240118_009',
    'failed',
    NULL,
    NOW() - INTERVAL 2 DAY,
    NOW() - INTERVAL 2 DAY,
    JSON_OBJECT(
        'total_amount', 20000.00,
        'paid_amount', 10000.00,
        'base_amount', 18000.00,
        'addons_amount', 2000.00,
        'transport_amount', 0.00
    ),
    JSON_OBJECT(
        'error_code', 'INSUFFICIENT_FUNDS',
        'error_description', 'Insufficient funds in account',
        'error_reason', 'payment_failed'
    )
);

-- Payment 10: Failed payment (card declined)
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 9),
    3500.00,
    'INR',
    'razorpay',
    'pay_rzp_failed_777',
    'order_rzp_20240119_010',
    'failed',
    NULL,
    NOW() - INTERVAL 1 DAY,
    NOW() - INTERVAL 1 DAY,
    JSON_OBJECT(
        'total_amount', 7000.00,
        'paid_amount', 3500.00,
        'base_amount', 6000.00,
        'addons_amount', 1000.00,
        'transport_amount', 0.00
    ),
    JSON_OBJECT(
        'error_code', 'CARD_DECLINED',
        'error_description', 'Card declined by bank',
        'error_reason', 'payment_failed'
    )
);

-- Payment 11: Failed CCAvenue payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 10),
    5500.00,
    'INR',
    'ccavenue',
    'pay_cca_failed_888',
    'order_cca_20240120_011',
    'failed',
    NULL,
    NOW() - INTERVAL 12 HOUR,
    NOW() - INTERVAL 12 HOUR,
    JSON_OBJECT(
        'total_amount', 11000.00,
        'paid_amount', 5500.00,
        'base_amount', 9000.00,
        'addons_amount', 1500.00,
        'transport_amount', 500.00
    ),
    JSON_OBJECT(
        'error_code', 'PAYMENT_TIMEOUT',
        'error_description', 'Payment timeout',
        'error_reason', 'payment_failed'
    )
);

-- =====================================================
-- 5. Insert Payments with NULL booking_id (for testing)
-- =====================================================

-- Payment 12: Payment without booking (standalone payment)
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    NULL,
    2000.00,
    'INR',
    'razorpay',
    'pay_rzp_standalone_999',
    'order_rzp_20240121_012',
    'success',
    NOW() - INTERVAL 3 HOUR,
    NOW() - INTERVAL 3 HOUR,
    NOW() - INTERVAL 3 HOUR,
    JSON_OBJECT(
        'total_amount', 2000.00,
        'paid_amount', 2000.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_standalone_999',
        'payment_method', 'upi'
    )
);

-- =====================================================
-- 6. Insert Payments with Different Amounts (for statistics testing)
-- =====================================================

-- Payment 13: Small amount payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 11),
    500.00,
    'INR',
    'razorpay',
    'pay_rzp_small_001',
    'order_rzp_20240115_013',
    'success',
    NOW() - INTERVAL 5 DAY,
    NOW() - INTERVAL 5 DAY,
    NOW() - INTERVAL 5 DAY,
    JSON_OBJECT(
        'total_amount', 1000.00,
        'paid_amount', 500.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_small_001',
        'payment_method', 'card'
    )
);

-- Payment 14: Large amount payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 12),
    50000.00,
    'INR',
    'razorpay',
    'pay_rzp_large_002',
    'order_rzp_20240116_014',
    'success',
    NOW() - INTERVAL 4 DAY,
    NOW() - INTERVAL 4 DAY,
    NOW() - INTERVAL 4 DAY,
    JSON_OBJECT(
        'total_amount', 100000.00,
        'paid_amount', 50000.00,
        'base_amount', 80000.00,
        'addons_amount', 15000.00,
        'transport_amount', 5000.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_large_002',
        'payment_method', 'netbanking',
        'bank_name', 'State Bank of India'
    )
);

-- Payment 15: Medium amount payment
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 13),
    15000.00,
    'INR',
    'ccavenue',
    'pay_cca_medium_003',
    'order_cca_20240117_015',
    'success',
    NOW() - INTERVAL 3 DAY,
    NOW() - INTERVAL 3 DAY,
    NOW() - INTERVAL 3 DAY,
    JSON_OBJECT(
        'total_amount', 30000.00,
        'paid_amount', 15000.00,
        'base_amount', 25000.00,
        'addons_amount', 4000.00,
        'transport_amount', 1000.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_medium_003',
        'payment_method', 'card',
        'card_last4', '1234'
    )
);

-- =====================================================
-- 7. Insert Payments with Different Dates (for date filtering testing)
-- =====================================================

-- Payment 16: Payment from 30 days ago
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 14),
    4000.00,
    'INR',
    'razorpay',
    'pay_rzp_old_004',
    'order_rzp_20231221_016',
    'success',
    DATE_SUB(NOW(), INTERVAL 30 DAY),
    DATE_SUB(NOW(), INTERVAL 30 DAY),
    DATE_SUB(NOW(), INTERVAL 30 DAY),
    JSON_OBJECT(
        'total_amount', 8000.00,
        'paid_amount', 4000.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_old_004',
        'payment_method', 'upi'
    )
);

-- Payment 17: Payment from 7 days ago
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 15),
    6500.00,
    'INR',
    'razorpay',
    'pay_rzp_week_005',
    'order_rzp_20240114_017',
    'success',
    DATE_SUB(NOW(), INTERVAL 7 DAY),
    DATE_SUB(NOW(), INTERVAL 7 DAY),
    DATE_SUB(NOW(), INTERVAL 7 DAY),
    JSON_OBJECT(
        'total_amount', 13000.00,
        'paid_amount', 6500.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_week_005',
        'payment_method', 'wallet'
    )
);

-- Payment 18: Payment from today
INSERT INTO payments (
    booking_id,
    amount,
    currency,
    provider,
    provider_payment_id,
    order_id,
    status,
    paid_at,
    created_at,
    updated_at,
    details,
    gateway_response
) VALUES (
    (SELECT id FROM bookings LIMIT 1 OFFSET 16),
    9000.00,
    'INR',
    'razorpay',
    'pay_rzp_today_006',
    'order_rzp_20240121_018',
    'success',
    NOW(),
    NOW(),
    NOW(),
    JSON_OBJECT(
        'total_amount', 18000.00,
        'paid_amount', 9000.00
    ),
    JSON_OBJECT(
        'transaction_id', 'txn_today_006',
        'payment_method', 'card'
    )
);

-- =====================================================
-- 8. Summary Query - Verify Inserted Data
-- =====================================================

-- After running all inserts, verify the data:
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

-- View all payments with booking info:
SELECT 
    p.id,
    p.booking_id,
    b.booking_reference,
    p.amount,
    p.currency,
    p.provider,
    p.status,
    p.created_at,
    p.paid_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
ORDER BY p.created_at DESC;

-- =====================================================
-- 9. Cleanup Query (Use with caution!)
-- =====================================================

-- To remove all dummy payments (uncomment to use):
-- DELETE FROM payments WHERE provider_payment_id LIKE 'pay_%_%' OR order_id LIKE 'order_%_%';

