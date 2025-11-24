# Account Request Feature

**Date:** November 23, 2025  
**Feature:** Self-Service Account Request System  
**Status:** ✅ Implemented

## Overview

The Account Request feature allows potential users to request access to PowerNOVA directly from the login modal. This replaces the generic "Contact your administrator" message with a functional self-service system that:

1. ✅ Collects user information (name, email, company, justification)
2. ✅ Validates email addresses (ensures user provides valid contact info)
3. ✅ Stores requests in the existing feedback table
4. ✅ Allows admins to review requests in the existing Feedback admin UI
5. ✅ Enables admins to create accounts and email credentials manually

## User Flow

### Requesting an Account

1. User visits PowerNOVA chat interface
2. Clicks "Login" button
3. Sees "Don't have an account? **Request an account**" link
4. Clicks the link to open Account Request modal
5. Fills out the form:
   - **Full Name** (required)
   - **Email Address** (required, validated)
   - **Company/Organization** (required)
   - **Justification for Access** (required, minimum 20 characters)
6. Submits the request
7. Receives confirmation message
8. Waits for admin approval

### Admin Review and Approval

1. Admin logs into PowerNOVA Admin Dashboard
2. Navigates to **💬 Feedback** tab
3. Sees account requests with **👤 Account Request** badge
4. Clicks "View" to review details:
   - Name
   - Email (will be used for login)
   - Company
   - Justification message
5. Evaluates the request
6. If approved:
   - Creates user account in **👥 Users** tab
   - Uses the email from the request as the username
   - Generates a secure temporary password
   - Sends login credentials via email (manual process)
7. Updates request status to "Resolved"
8. Adds admin notes about the decision

## Technical Implementation

### Database Schema

**Table:** `feedback`

New column added:
```sql
request_type VARCHAR(50) DEFAULT 'feedback'
  - Values: 'feedback', 'account_request'
  - Indexed for fast filtering
```

### Backend API

**Endpoint:** `POST /feedback`

Request body for account requests:
```json
{
  "name": "John Doe",
  "email": "john.doe@company.com",
  "company": "Acme Corporation",
  "message": "I need access to PowerNOVA to analyze our company documents...",
  "request_type": "account_request"
}
```

Response:
```json
{
  "success": true,
  "message": "Thank you for your account request! We'll review it and contact you at the provided email address.",
  "feedback_id": 42
}
```

### Frontend Components

**Files Modified:**

1. **app/index.html**
   - Updated login modal footer with "Request an account" link
   - Added Account Request Modal with form fields

2. **app/js/app.js**
   - Added `openAccountRequestModal()` function
   - Added `closeAccountRequestModal()` function
   - Added form submission handler for account requests
   - Added validation and error handling

3. **app/css/styles.css**
   - Added `.link-primary` and `.link-secondary` styles
   - Added `.success-message` style
   - Added form field styling for account request modal

4. **app/admin.html**
   - Added "Request Type" column in feedback detail modal

5. **app/js/admin.js**
   - Updated `loadFeedback()` to display request type badges
   - Updated `viewFeedbackDetails()` to show request type
   - Added `.badge-highlight` style for account requests

6. **app/css/admin.css**
   - Added `.badge-primary` and `.badge-highlight` styles

### Database Migration

**File:** `api/alembic/versions/2025_11_23_add_request_type_to_feedback.py`

Run migration:
```bash
cd api
alembic upgrade head
```

## Admin Workflow

### Step 1: Review Account Request

1. Open Admin Dashboard → **💬 Feedback** tab
2. Look for entries with **👤 Account Request** badge
3. Click "View" to see full details
4. Verify:
   - Email address is valid
   - Company/organization is legitimate
   - Justification makes sense
   - No suspicious activity

### Step 2: Create User Account

1. Go to **👥 Users** tab
2. Click "Create User" button
3. Fill in details:
   - **Username:** Use the email from the request (e.g., `john.doe@company.com`)
   - **Password:** Generate a secure temporary password (e.g., `TempPass2025!`)
   - **Role:** Select appropriate role (usually `user`)
   - **Must Change Password:** Check this box ✓

### Step 3: Send Login Credentials

**Email Template:**

```
Subject: Your PowerNOVA Account Access

Dear [Name],

Your request for access to PowerNOVA has been approved!

Login Details:
- URL: https://your-powernova-domain.com
- Username: john.doe@company.com
- Temporary Password: TempPass2025!

For security reasons, you will be required to change your password upon first login.

If you have any questions, please don't hesitate to reach out.

Best regards,
PowerNOVA Team
```

**Note:** Currently, email sending is a manual process. Future enhancement could automate this.

### Step 4: Update Request Status

1. Return to **💬 Feedback** tab
2. Find the account request
3. Click "View"
4. Update:
   - **Status:** Change to "Resolved"
   - **Admin Notes:** Add note like "Account created. Login credentials sent to john.doe@company.com on 2025-11-23"
5. Click "Save Changes"

### Step 5: Follow Up (If Denied)

If the request is denied:

1. Update status to "Resolved" or "Archived"
2. Add admin notes explaining the reason
3. Optionally, send a polite rejection email:

```
Subject: Re: Your PowerNOVA Account Request

Dear [Name],

Thank you for your interest in PowerNOVA.

After reviewing your request, we are unable to provide access at this time because [reason].

If you have any questions or would like to discuss this further, please contact us at [support email].

Best regards,
PowerNOVA Team
```

## Security Considerations

### Email Validation

- ✅ Email addresses are validated using Pydantic's `EmailStr` type
- ✅ Ensures valid email format before submission
- ✅ Prevents typos that could lead to lost credentials

### Spam Prevention

**Current:**
- No CAPTCHA or rate limiting implemented
- Relies on email validation and admin review

**Future Enhancements:**
1. Add reCAPTCHA to prevent bot submissions
2. Implement rate limiting (e.g., 3 requests per IP per day)
3. Add email verification step (send confirmation link)
4. Track IP addresses for abuse detection

### Data Privacy

- ✅ Account requests stored securely in database
- ✅ Only admins can view requests (requires API key)
- ✅ Email addresses are indexed but not publicly exposed
- ⚠️ No automatic PII deletion (manual cleanup required)

## User Interface

### Login Modal - Before

```
Don't have an account? Contact your administrator.
```

### Login Modal - After

```
Don't have an account? [Request an account] (clickable link)
```

### Account Request Modal

```
┌─────────────────────────────────────────┐
│ 📝 Request Account Access           [✕] │
├─────────────────────────────────────────┤
│ Fill out the form below to request     │
│ access to PowerNOVA. We'll review your │
│ request and contact you via email.     │
│                                         │
│ Full Name *                             │
│ [Enter your full name               ]  │
│                                         │
│ Email Address *                         │
│ [your@email.com                     ]  │
│ This email will be used for your       │
│ account login                           │
│                                         │
│ Company/Organization *                  │
│ [Enter your company name            ]  │
│                                         │
│ Justification for Access *              │
│ [Please explain why you need access ]  │
│ [to PowerNOVA...                    ]  │
│ Minimum 20 characters                   │
│                                         │
│         [📨 Submit Request]             │
│                                         │
│ ← Back to Login                         │
└─────────────────────────────────────────┘
```

### Admin Feedback List

```
┌──────────────────────────────────────────────────────────────┐
│ ID │ Type              │ Name      │ Email       │ Status    │
├──────────────────────────────────────────────────────────────┤
│ 42 │ 👤 Account Request│ John Doe  │ john@...    │ 🆕 New    │
│ 41 │ 💬 Feedback       │ Jane S.   │ jane@...    │ ✅ Resolved│
└──────────────────────────────────────────────────────────────┘
```

### Admin Feedback Detail Modal

```
┌─────────────────────────────────────────┐
│ Feedback Details                    [✕] │
├─────────────────────────────────────────┤
│ Request Type                            │
│ 👤 Account Request                      │
│                                         │
│ Name                                    │
│ [John Doe                           ]   │
│                                         │
│ Email                                   │
│ [john.doe@company.com               ]   │
│                                         │
│ Company                                 │
│ [Acme Corporation                   ]   │
│                                         │
│ Message                                 │
│ [I need access to PowerNOVA to      ]   │
│ [analyze our company documents...   ]   │
│                                         │
│ Status                                  │
│ [🆕 New ▼]                              │
│                                         │
│ Admin Notes                             │
│ [Account created. Credentials sent  ]   │
│ [to john.doe@company.com on         ]   │
│ [2025-11-23]                            │
│                                         │
│          [Cancel] [Save Changes]        │
└─────────────────────────────────────────┘
```

## Validation Rules

### Client-Side (JavaScript)

- **Name:** Required, minimum 1 character
- **Email:** Required, valid email format
- **Company:** Required, minimum 1 character
- **Justification:** Required, minimum 20 characters

### Server-Side (FastAPI/Pydantic)

- **Name:** String, 1-255 characters
- **Email:** Valid email format (Pydantic `EmailStr`)
- **Company:** Optional, max 255 characters
- **Message:** String, minimum 10 characters
- **Request Type:** Enum ('feedback' or 'account_request')

## Error Handling

### Frontend Errors

**Invalid Email:**
```
Please enter a valid email address
```

**Justification Too Short:**
```
Justification must be at least 20 characters
```

**Network Error:**
```
Failed to submit request. Please try again.
```

### Backend Errors

**Database Error:**
```
Failed to submit feedback: [error details]
```

**Validation Error:**
```
Invalid request data: [field] - [error message]
```

## Future Enhancements

### Phase 1: Automation
1. **Email Integration:**
   - Automatic email sending on account creation
   - Templates for approval/rejection
   - Email verification link in request flow

2. **Status Notifications:**
   - Notify requester when status changes
   - Send reminders to admins for pending requests

### Phase 2: Advanced Features
1. **Self-Service Signup:**
   - Allow certain domains to auto-approve (e.g., @yourcompany.com)
   - Email verification before admin review
   - Waiting list for high-demand periods

2. **Enhanced Security:**
   - reCAPTCHA integration
   - Rate limiting per IP/email
   - Suspicious pattern detection
   - IP blacklisting

3. **Analytics:**
   - Track request-to-approval conversion rate
   - Monitor average response time
   - Identify common justifications
   - Geographic distribution of requests

### Phase 3: Integration
1. **SSO Integration:**
   - OAuth2/OpenID Connect
   - SAML for enterprise customers
   - Auto-create accounts for verified domains

2. **CRM Integration:**
   - Sync requests to Salesforce/HubSpot
   - Track in sales pipeline
   - Automated lead scoring

## Testing Checklist

### User Flow Testing
- [ ] Open login modal
- [ ] Click "Request an account" link
- [ ] Verify account request modal opens
- [ ] Fill out form with valid data
- [ ] Submit request
- [ ] Verify success message appears
- [ ] Verify modal closes after 3 seconds
- [ ] Check that request appears in database

### Admin Flow Testing
- [ ] Login to admin dashboard
- [ ] Navigate to Feedback tab
- [ ] Verify account request appears with badge
- [ ] Click "View" to see details
- [ ] Verify all fields display correctly
- [ ] Update status to "Resolved"
- [ ] Add admin notes
- [ ] Save changes
- [ ] Verify changes persist

### Edge Cases
- [ ] Submit with missing fields (should show validation errors)
- [ ] Submit with invalid email (should reject)
- [ ] Submit with very short justification (should reject)
- [ ] Submit duplicate requests (should allow, track separately)
- [ ] Submit very long messages (should truncate or handle gracefully)
- [ ] Submit with special characters in name/company
- [ ] Submit while not connected to internet (should show error)

## Deployment

### Required Steps

1. **Run Database Migration:**
   ```bash
   cd api
   alembic upgrade head
   ```

2. **Deploy Updated Code:**
   ```bash
   ./scripts/azure-deploy-api.sh
   ```

3. **Verify Migration:**
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'feedback' 
   AND column_name = 'request_type';
   ```

4. **Test Feature:**
   - Submit test account request
   - Verify it appears in admin dashboard
   - Verify badge displays correctly

### Rollback Plan

If issues occur:

```bash
cd api
alembic downgrade -1
```

This will:
- Remove `request_type` column from feedback table
- Drop the enum type
- Preserve all existing feedback data

## Support and Troubleshooting

### Common Issues

**Issue:** Request submission fails with "Failed to submit request"
- **Cause:** API endpoint not accessible
- **Solution:** Check API_BASE_URL in config.js, verify API is running

**Issue:** Account request not showing in admin dashboard
- **Cause:** Database migration not run
- **Solution:** Run `alembic upgrade head`

**Issue:** Badge not displaying in admin UI
- **Cause:** CSS not loaded or old cache
- **Solution:** Hard refresh browser (Ctrl+Shift+R), clear cache

**Issue:** Email validation not working
- **Cause:** Invalid email format
- **Solution:** Use standard email format (user@domain.com)

### Database Queries

**Count account requests:**
```sql
SELECT COUNT(*) FROM feedback WHERE request_type = 'account_request';
```

**Find pending account requests:**
```sql
SELECT * FROM feedback 
WHERE request_type = 'account_request' 
AND status = 'new'
ORDER BY created_at DESC;
```

**Account request conversion rate:**
```sql
SELECT 
    COUNT(*) as total_requests,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as approved,
    ROUND(100.0 * SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) / COUNT(*), 2) as approval_rate
FROM feedback 
WHERE request_type = 'account_request';
```

## Summary

The Account Request feature provides a streamlined, self-service way for potential users to request access to PowerNOVA. By reusing the existing feedback infrastructure, it requires minimal code changes while providing significant value to both users and administrators.

**Key Benefits:**
- ✅ Users can request access 24/7 without contacting support
- ✅ Email validation ensures contact information is correct
- ✅ Admins have a centralized place to review all requests
- ✅ Reuses existing feedback UI and infrastructure
- ✅ Provides audit trail of all account requests
- ✅ Enables data-driven decisions about access policies

**Next Steps:**
1. Deploy the feature to production
2. Monitor usage and approval rates
3. Gather feedback from admins
4. Plan Phase 1 enhancements (email automation)
