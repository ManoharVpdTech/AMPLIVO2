# Brevo Email Configuration & Setup Guide

This guide explains how transactional email delivery is configured in AMPLIVO and how to enable real inbox delivery using Brevo (formerly Sendinblue).

---

## 1. Overview & Architecture

AMPLIVO uses Brevo's Transactional Email HTTP API (`https://api.brevo.com/v3/smtp/email`) for:
- User Registration Email Verification
- Password Reset Token Emails
- Client Portal Welcome & Temporary Password Emails
- Notification Digest Emails

When `BREVO_API_KEY` is not present in `.env`, the system automatically defaults to a safe **In-Memory Outbox Stub** (`SentEmail` queue). This prevents unit test failures and avoids accidental email delivery during development while recording dispatched emails for verification.

---

## 2. Environment Variables Configuration

To enable live email delivery, add the following variables to `backend/.env`:

```env
# Brevo API Key (API Key v3 from Brevo Dashboard -> SMTP & API)
BREVO_API_KEY="xkeysib-..."

# Verified Sender Email (Must match a verified domain/sender in Brevo)
BREVO_SENDER_EMAIL="no-reply@amplivo.in"

# Display Sender Name
BREVO_SENDER_NAME="Amplivo Platform"
```

---

## 3. Step-by-Step Production Setup

1. **Create a Brevo Account**: Sign up at [https://www.brevo.com](https://www.brevo.com).
2. **Verify Sender Domain**:
   - Go to **Senders & IPs** -> **Domains**.
   - Add your domain (e.g. `amplivo.in`) and configure DNS records (DKIM, SPF, DMARC).
3. **Generate API Key**:
   - Go to **SMTP & API** -> **API Keys**.
   - Click **Generate a new API key**, name it `AMPLIVO-Production`, and copy the generated key.
4. **Update `.env`**:
   - Set `BREVO_API_KEY` in `backend/.env`.
5. **Restart Backend Server**:
   - Restart the FastAPI backend server (`python -m uvicorn app.main:app --reload`).

---

## 4. Troubleshooting & Verification

- **Log Check**: On startup, inspect the logs. If `BREVO_API_KEY` is active, no warnings will appear during email dispatch.
- **API Status Check**: Execute a password reset or verification request; inspect Brevo dashboard -> **Transactional** -> **Logs** to view delivery status.
