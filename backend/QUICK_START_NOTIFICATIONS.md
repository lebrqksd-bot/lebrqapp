# 🚀 Quick Start: Booking Notifications

## ✅ What's Been Implemented

When an admin **approves** or **rejects** a booking, the system automatically sends notifications to the user via:

1. ✉️ **Email** - Professional HTML emails
2. 📱 **SMS** - Text messages via Twilio  
3. 💬 **WhatsApp** - Messages via Twilio/BSP
4. 🔔 **In-App** - Stored in database

---

## 🎯 Quick Setup (5 Minutes)

### Option 1: Email Only (Recommended for Start)

1. **Create/Edit** `backend/.env`:
```bash
# Email with Gmail (FREE)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=lebrqksd@gmail.com
SMTP_PASSWORD=qtfj tsid rljx tzvf
SMTP_FROM_EMAIL=lebrqksd@gmail.com
SMTP_USE_TLS=True
```

2. **Get Gmail App Password**:
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification
   - Search "App passwords"
   - Generate password for "Mail"
   - Copy 16-character password

3. **Restart Backend**:
```bash
cd backend
python -m uvicorn app:app --reload
```

**Done!** Emails will now be sent automatically ✅

---

### Option 2: Full Setup (Email + SMS + WhatsApp)

Add to `backend/.env`:
```bash
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=True

# SMS & WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
```

Get Twilio credentials: https://www.twilio.com/try-twilio

---

## 📧 Notification Templates

### Approval Email:
- ✅ Green success design
- Booking reference, venue, date/time
- Amount to pay
- Call-to-action

### Rejection Email:
- ⚠️ Professional rejection notice
- Reason from admin note
- Encouragement to book another slot

### SMS/WhatsApp:
- Short, clear messages
- Key booking details
- Reference number

---

## 🧪 Testing

### Test Approval:
1. Go to Admin Panel → Bookings
2. Click "Approve" on a pending booking
3. Add an optional note
4. **User receives notification instantly!**

### Check Logs:
```bash
# Backend console will show:
[NOTIFICATION] Approval email sent to user@example.com
[NOTIFICATION] SMS sent to +919876543210: SMxxxxxxxxxx
[NOTIFICATION] In-app notification created for user 5
```

---

## 📂 Files Created/Modified

### New Files:
- `backend/app/notifications.py` - Notification service
- `backend/NOTIFICATION_SETUP.md` - Detailed setup guide
- `backend/QUICK_START_NOTIFICATIONS.md` - This file

### Modified Files:
- `backend/app/core.py` - Added email/SMS settings
- `backend/app/routers/admin_bookings.py` - Added notification triggers

---

## 🎨 Customization

Edit templates in `backend/app/notifications.py`:

**Email HTML:**
```python
# Line ~150: _send_approval_email()
html_content = f"""
<html>
  <!-- Customize HTML here -->
</html>
"""
```

**SMS Text:**
```python
# Line ~230: _send_approval_sms()
message_body = "Your custom message..."
```

---

## ❓ FAQ

**Q: Do I need to configure all notification types?**  
A: No! Start with just email. Add others when ready.

**Q: Will bookings still work if notifications fail?**  
A: Yes! Notifications are non-blocking. Booking approval/rejection always succeeds.

**Q: How do I test without sending real emails?**  
A: Leave `SMTP_HOST` empty. Logs will show "Would send email to..."

**Q: Can I use my own email provider?**  
A: Yes! Use any SMTP server (Gmail, SendGrid, Mailgun, etc.)

**Q: Is Twilio free?**  
A: Trial account is free with $15 credit. Sandbox for WhatsApp testing.

---

## 🐛 Troubleshooting

### Email not sending?
```bash
# Check logs for errors
tail -f backend/logs/app.log

# Test SMTP connection
python -c "import smtplib; s=smtplib.SMTP('smtp.gmail.com',587); s.starttls(); print('OK')"
```

### SMS failing?
- Verify phone number format: `+[country code][number]`
- Check Twilio account balance
- Verify number on trial account

---

## 📱 Next Steps

1. ✅ **Set up email notifications** (5 mins)
2. ✅ **Test with real booking** (2 mins)
3. 🎨 **Customize email templates** (10 mins)
4. 📱 **Add SMS** (optional, when ready)
5. 💬 **Add WhatsApp** (optional, when ready)

---

## 🎉 You're All Set!

Users will now receive instant notifications when their bookings are approved or rejected!

For detailed documentation, see `NOTIFICATION_SETUP.md`

