# CCAvenue Payment Gateway Integration

This document describes the CCAvenue payment gateway integration for the LebrqApp.

## Overview

The payment system includes:
- Backend API endpoints for payment processing
- CCAvenue payment gateway integration
- Frontend payment pages
- Database models for payments and bookings

## Setup

### 1. Environment Variables

Create a `.env` file in the backend directory with the following CCAvenue credentials:

```env
# CCAvenue Payment Gateway Configuration
CCAVENUE_MERCHANT_ID=your_merchant_id_here
CCAVENUE_ACCESS_CODE=your_access_code_here
CCAVENUE_WORKING_KEY=your_working_key_here
CCAVENUE_REDIRECT_URL=http://localhost:19006/payment/success
CCAVENUE_CANCEL_URL=http://localhost:19006/payment/cancel
CCAVENUE_BASE_URL=https://secure.ccavenue.com/transaction
```

### 2. Database Setup

Run the payment tables creation script:

```bash
cd backend
python create_payment_tables.py
```

### 3. Backend Dependencies

Install required dependencies:

```bash
pip install requests
```

## API Endpoints

### Payment Creation
- **POST** `/api/payments/create`
- Creates a new payment request and returns CCAvenue payment URL
- Requires authentication

### Payment Callback
- **POST** `/api/payments/callback`
- Handles payment response from CCAvenue
- Updates payment status in database

### Payment Status
- **GET** `/api/payments/status/{payment_id}`
- Get payment status for a specific payment
- Requires authentication

### Refund
- **POST** `/api/payments/refund/{payment_id}`
- Initiate refund for a payment
- Requires authentication

## Frontend Pages

### Payment Page (`/payment`)
- Displays booking summary
- Collects billing information
- Redirects to CCAvenue payment gateway

### Payment Success (`/payment/success`)
- Shows payment success confirmation
- Displays transaction details
- Provides navigation options

### Payment Cancel (`/payment/cancel`)
- Shows payment cancellation message
- Provides retry options

## Database Models

### Payment
- Stores payment information
- Links to booking
- Tracks payment status

### Booking
- Stores booking details
- Links to user and space
- Tracks booking status

### BookingAddon
- Stores add-on selections for bookings
- Links to booking
- Tracks quantities and prices

## Payment Flow

1. User selects venue and options
2. User clicks "Pay Now" button
3. System creates booking record
4. System creates payment request
5. User is redirected to CCAvenue
6. User completes payment on CCAvenue
7. CCAvenue redirects back to success/cancel page
8. System verifies payment and updates status

## Security Features

- Data encryption using CCAvenue's encryption method
- Checksum validation for payment responses
- Secure token-based authentication
- SSL/TLS encryption for all API calls

## Testing

### Test Mode
For testing, use CCAvenue's test credentials and test URLs.

### Test Cards
CCAvenue provides test card numbers for different scenarios:
- Success: 4111111111111111
- Failure: 4000000000000002
- 3D Secure: 4000000000000002

## Error Handling

The system handles various error scenarios:
- Network errors
- Payment failures
- Invalid responses
- Database errors
- Authentication errors

## Monitoring

Payment statuses are tracked in the database:
- `pending`: Payment initiated
- `success`: Payment completed
- `failed`: Payment failed
- `cancelled`: Payment cancelled
- `refunded`: Payment refunded

## Support

For payment-related issues:
1. Check payment status in database
2. Verify CCAvenue credentials
3. Check network connectivity
4. Review error logs
5. Contact CCAvenue support if needed
