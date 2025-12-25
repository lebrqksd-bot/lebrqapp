# 📬 Notification Setup Guide

This guide explains how to configure different notification methods for sending booking updates to users.

## 🎯 Notification Methods

1. **Email** ✉️ - Professional, reliable
2. **SMS** 📱 - Instant, direct
3. **WhatsApp** 💬 - Popular, engaging
4. **In-App** 🔔 - Always available

---

## ✉️ 1. Email Notifications (SMTP)

### Gmail Setup (Recommended for Testing)

1. **Enable 2-Factor Authentication** in your Gmail account
2. **Create an App Password**:
   - Go to Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Generate a password for "Mail"

3. **Add to `.env`**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=True
```

### Other SMTP Providers

**SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_USE_TLS=True
```

**Mailgun:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_USE_TLS=True
```

---

## 📱 2. SMS Notifications (Twilio)

### Setup Steps:

1. **Sign up for Twilio**: https://www.twilio.com/try-twilio
2. **Get a Phone Number** (with SMS capability)
3. **Find your credentials** in Twilio Console

4. **Add to `.env`**:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Testing SMS:
- Twilio trial accounts can only send to verified numbers
- Add test numbers in Twilio Console → Phone Numbers → Verified Caller IDs

---

## 💬 3. WhatsApp Notifications

### Option A: Twilio WhatsApp Sandbox (Testing)

1. **Join Twilio Sandbox**:
   - Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Send the join code to the sandbox number

2. **Add to `.env`**:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
```

### Option B: WhatsApp Business API (Production)

1. **Apply for WhatsApp Business API** through:
   - Twilio: https://www.twilio.com/whatsapp
    - Route Mobile: https://routemobile.com/
   - Meta Business: https://business.facebook.com/
   - BSP (Business Solution Provider)

2. **Get your WhatsApp number approved**
### Route Mobile configuration

If you're using Route Mobile as your BSP, set these in your backend `.env`:

```
ROUTEMOBILE_BASE_URL=https://api.rmlconnect.net
ROUTEMOBILE_CLIENT_ID=your_client_id            # if your account requires OAuth client credentials
ROUTEMOBILE_CLIENT_SECRET=your_client_secret    # if your account requires OAuth client credentials
ROUTEMOBILE_SENDER=+91XXXXXXXXXX               # your approved WA BUSINESS number (not the recipient)
ROUTEMOBILE_TEMPLATE_LANGUAGE=en
ROUTEMOBILE_TEMPLATE_BOOKINGREG=bookingreg
ROUTEMOBILE_TEMPLATE_SIMPLE=hello              # optional: a simple 1-variable approved template alias
```

On admin approve/reject, the backend will send the WhatsApp template `bookingreg` with ordered variables similar to:

- approve: `[user_name, booking_reference, venue_name, space_name, start_datetime, end_datetime, total_amount, event_type, 'approved']`
- reject: `[user_name, booking_reference, venue_name, space_name, start_datetime, admin_note, 'rejected']`

Adjust your template placeholders to match or update the payload composition in `app/services/whatsapp_route_mobile.py`.

If you want a quick sanity test with the smallest template, approve a simple template like `hello` with 1 body placeholder. Then call the test endpoint with:

```
POST /api/notifications/wa-test
{
    "phone": "91812XXXXXXX",
    "template_name": "simple"  // maps to ROUTEMOBILE_TEMPLATE_SIMPLE (default 'hello')
}
```
This sends a single body variable of "Test" by default. You can override variables if needed.

3. **Update `.env`** with your production number

---

## 🔔 4. In-App Notifications

**Automatically enabled!** No configuration needed.

Notifications are stored in database and can be displayed in your app.

### Retrieve User Notifications:

```python
# backend/app/routers/notifications.py (create this)
@router.get('/notifications')
async def get_user_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await session.execute(
        text("""
            SELECT * FROM notifications 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC 
            LIMIT 20
        """),
        {'user_id': current_user.id}
    )
    return result.fetchall()
```

---

## 🚀 Quick Start

### Minimal Setup (Email only):

Create `backend/.env`:
```bash
# Database
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DB=lebrq

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=True
```

### Full Setup (All notifications):

```bash
# Database
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DB=lebrq

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=True

# SMS & WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
```

---

## ✅ Testing Notifications

### 1. Restart Backend:
```bash
cd backend
python -m uvicorn app:app --reload
```

### 2. Test Booking Approval:
```bash
# Approve a booking
curl -X POSThttps://taxtower.in:8002/api
admin/bookings/123/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Approved for your event!"}'
```

### 3. Check Logs:
Look for notification messages in console:
```
[NOTIFICATION] Approval email sent to user@example.com
[NOTIFICATION] SMS sent to +1234567890: SMxxxxxxxxxx
[NOTIFICATION] WhatsApp sent to +1234567890: SMxxxxxxxxxx
[NOTIFICATION] In-app notification created for user 5
```

---

## 🎨 Customize Notification Templates

Edit `backend/app/notifications.py`:

**Email templates**: Update HTML in `_send_approval_email()` and `_send_rejection_email()`

**SMS templates**: Update message text in `_send_approval_sms()` and `_send_rejection_sms()`

**WhatsApp templates**: Update message text in `_send_approval_whatsapp()` and `_send_rejection_whatsapp()`

---

## 🔧 Troubleshooting

### Email not sending?
- Check SMTP credentials
- Verify firewall isn't blocking port 587
- For Gmail, ensure App Password is used (not regular password)
- Check spam folder

### SMS not sending?
- Verify phone numbers include country code (+91 for India)
- Check Twilio account balance
- Verify number is verified (if trial account)

### WhatsApp not working?
- Ensure user has joined sandbox (for testing)
- Verify WhatsApp Business API is approved (for production)
- Check number format: +[country code][number]

---

## 📊 Monitor Notifications

Add logging to track notification delivery:

```python
# In notifications.py, all methods already include logging
print(f"[NOTIFICATION] Email sent to {email}")
print(f"[NOTIFICATION] SMS sent to {mobile}: {message.sid}")
```

Check backend console for these logs when bookings are approved/rejected.

---

## 💡 Best Practices

1. **Start with Email** - Most reliable, no additional cost
2. **Add SMS** - For urgent notifications
3. **Add WhatsApp** - Popular in India, high engagement
4. **Always save In-App** - Backup notification method

5. **Test thoroughly** before going live
6. **Monitor delivery rates**
7. **Handle failures gracefully** (notifications shouldn't break booking flow)

---

## 📦 Required Packages

Already included in `requirements.txt`:
- `twilio` - For SMS and WhatsApp
- Built-in `smtplib` - For email

If missing, install:
```bash
cd backend
pip install twilio
```

---

## 🎉 You're Done!

Notifications will now be sent automatically when admin approves or rejects bookings!

**Next Steps:**
1. Configure at least email notifications
2. Test with a real booking
3. Customize templates to match your branding
4. Add SMS/WhatsApp when ready

