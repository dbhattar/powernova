# Feedback System - Testing Guide

**Date**: November 22, 2024  
**Status**: ✅ Ready for Testing

## Quick Test Steps

### 1. Test Landing Page Form Submission

1. Open landing page: http://localhost:8080
2. Scroll down to the "Get Started" section (contact form)
3. Fill out the form:
   - **Name**: Test User
   - **Email**: test@example.com
   - **Company**: Test Company (optional)
   - **Message**: This is a test feedback message from the landing page.
4. Click "Send Message"
5. **Expected**: Success alert "Thank you! Your message has been sent successfully. We'll get back to you soon."

### 2. Verify in Database

```bash
docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT id, name, email, company, LEFT(message, 40) as message_preview, status, created_at FROM feedback ORDER BY created_at DESC LIMIT 5;"
```

**Expected Output**:
```
 id |    name    |      email       |    company    |           message_preview            | status |         created_at
----+------------+------------------+---------------+--------------------------------------+--------+---------------------------
  1 | Test User  | test@example.com | Test Company  | This is a test feedback message from | new    | 2024-11-22 07:20:15.123456
```

### 3. Test Admin Dashboard

1. Open admin dashboard: http://localhost:8081/admin.html
2. Enter admin key when prompted
3. Click the **"💬 Feedback"** tab
4. **Expected**:
   - Stats cards show: Total: 1, New: 1, In Progress: 0, Resolved: 0
   - Feedback table shows your test submission
   - Status badge shows 🆕 New

### 4. Test View Feedback Details

1. Click the **"View"** button on your test feedback
2. **Expected**: Modal opens showing:
   - Name: Test User (readonly)
   - Email: test@example.com (readonly)
   - Company: Test Company (readonly)
   - Full message (readonly)
   - Status dropdown: New (editable)
   - Admin Notes: empty textarea (editable)
   - Submitted timestamp

### 5. Test Status Change

1. In the feedback detail modal, change status to **"In Progress"**
2. Add admin notes: "Following up with the customer"
3. Click **"Save Changes"**
4. **Expected**:
   - Success alert
   - Modal closes
   - Feedback list refreshes
   - Status badge changes to 🔄 In Progress
   - Stats update: New: 0, In Progress: 1

### 6. Test Resolved Status

1. Click **"View"** again
2. Change status to **"Resolved"**
3. Update admin notes: "Customer contacted, issue resolved"
4. Click **"Save Changes"**
5. **Expected**:
   - Success alert
   - Status badge changes to ✅ Resolved
   - Stats update: In Progress: 0, Resolved: 1
   - Re-open modal and verify "Resolved" timestamp is now shown

### 7. Test Status Filter

1. Change the status filter dropdown to **"New"**
2. **Expected**: No feedback shown (we changed it to Resolved)
3. Change filter to **"Resolved"**
4. **Expected**: Your test feedback appears
5. Change filter to **"All"**
6. **Expected**: All feedback shown regardless of status

### 8. Test Delete Feedback

1. Click the **"Delete"** button on your test feedback
2. **Expected**: Confirmation dialog appears
3. Click **"OK"** to confirm
4. **Expected**:
   - Success alert
   - Feedback removed from list
   - Stats update: Total: 0, Resolved: 0
5. Verify in database:
   ```bash
   docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT COUNT(*) FROM feedback;"
   ```
   **Expected**: count = 0

## Advanced Testing

### Test Multiple Feedback Submissions

Submit 5 different feedback entries from the landing page:

1. **Sales Inquiry** - status: new
   ```
   Name: Jane Smith
   Email: jane@acmecorp.com
   Company: Acme Corp
   Message: We're interested in PowerNOVA for our enterprise needs. Can you provide pricing?
   ```

2. **Support Request** - status: in_progress
   ```
   Name: Bob Johnson
   Email: bob@startup.io
   Company: Startup.io
   Message: Having trouble with document upload. Getting a 500 error.
   ```

3. **Feature Request** - status: new
   ```
   Name: Alice Williams
   Email: alice@techfirm.com
   Company: TechFirm
   Message: Would love to see integration with Slack for notifications.
   ```

4. **Partnership** - status: new
   ```
   Name: Carlos Rodriguez
   Email: carlos@partner.com
   Company: Partner Inc
   Message: We'd like to discuss a partnership opportunity.
   ```

5. **General Inquiry** - status: resolved
   ```
   Name: David Lee
   Email: david@company.com
   Message: Just wanted to say the product looks great! Keep up the good work.
   ```

After submitting, verify:
- Stats show: Total: 5, New: 3, In Progress: 1, Resolved: 1
- All 5 appear in the feedback table
- Filter works for each status
- Pagination works if >20 entries

### Test API Directly

#### Submit Feedback (Public Endpoint)
```bash
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test User",
    "email": "apitest@example.com",
    "company": "API Test Co",
    "message": "This is a test submission via API"
  }'
```

**Expected Response (201 Created)**:
```json
{
  "id": 6,
  "name": "API Test User",
  "email": "apitest@example.com",
  "company": "API Test Co",
  "message": "This is a test submission via API",
  "status": "new",
  "admin_notes": null,
  "created_at": "2024-11-22T07:30:00.000000",
  "updated_at": "2024-11-22T07:30:00.000000",
  "resolved_at": null
}
```

#### Get All Feedback (Admin Endpoint)
```bash
# Replace YOUR_ADMIN_KEY with actual admin key
curl http://localhost:8000/api/admin/feedback \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Expected**: Array of all feedback entries

#### Get Feedback Stats
```bash
curl http://localhost:8000/api/admin/feedback/stats \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Expected**:
```json
{
  "total": 6,
  "new": 4,
  "in_progress": 1,
  "resolved": 1,
  "archived": 0
}
```

#### Get Single Feedback
```bash
curl http://localhost:8000/api/admin/feedback/1 \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Expected**: Full details of feedback #1

#### Update Feedback
```bash
curl -X PATCH http://localhost:8000/api/admin/feedback/1 \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "admin_notes": "Contacted customer via email"
  }'
```

**Expected**: Updated feedback object with new status and notes

#### Delete Feedback
```bash
curl -X DELETE http://localhost:8000/api/admin/feedback/1 \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Expected**: 204 No Content (empty response)

## Error Testing

### Test Validation Errors

#### Missing Required Fields
```bash
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User"
  }'
```

**Expected**: 422 Unprocessable Entity with validation errors

#### Invalid Email Format
```bash
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "not-an-email",
    "message": "Test message"
  }'
```

**Expected**: 422 Unprocessable Entity - invalid email format

### Test Authorization

#### Access Admin Endpoint Without Key
```bash
curl http://localhost:8000/api/admin/feedback
```

**Expected**: 401 Unauthorized

#### Access Admin Endpoint With Wrong Key
```bash
curl http://localhost:8000/api/admin/feedback \
  -H "X-Admin-Key: wrong-key"
```

**Expected**: 401 Unauthorized

## Browser Console Testing

### Landing Page
1. Open browser console (F12)
2. Submit feedback form
3. Check Network tab:
   - POST request to `/api/feedback`
   - Status: 201 Created
   - Response contains feedback object

### Admin Dashboard
1. Open browser console (F12)
2. Go to Feedback tab
3. Check Network tab:
   - GET `/api/admin/feedback/stats` - Stats data
   - GET `/api/admin/feedback` - Feedback list
4. Click "View" on a feedback:
   - GET `/api/admin/feedback/{id}` - Single feedback
5. Update status and save:
   - PATCH `/api/admin/feedback/{id}` - Update request
6. Delete feedback:
   - DELETE `/api/admin/feedback/{id}` - Delete request (204 No Content)

## Performance Testing

### Test With Many Feedback Entries

Generate 100 feedback entries:

```bash
for i in {1..100}; do
  curl -X POST http://localhost:8000/api/feedback \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Test User $i\",
      \"email\": \"user$i@test.com\",
      \"message\": \"Test message number $i\"
    }" > /dev/null 2>&1
  echo "Created feedback $i"
done
```

Then verify:
- Admin dashboard loads quickly
- Stats are accurate
- Table renders all entries
- Scrolling is smooth
- Filtering works efficiently

## Database Verification

### Check Table Structure
```bash
docker exec powernova-postgres psql -U powernova -d powernova -c "\d feedback"
```

**Expected**:
- All columns present (id, name, email, company, message, status, admin_notes, created_at, updated_at, resolved_at)
- Indexes on id, email, status

### Check Enum Type
```bash
docker exec powernova-postgres psql -U powernova -d powernova -c "\dT+ feedbackstatus"
```

**Expected**: Enum with values: new, in_progress, resolved, archived

### Check Constraints
```bash
docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT conname, contype, conkey FROM pg_constraint WHERE conrelid = 'feedback'::regclass;"
```

**Expected**: Primary key constraint on id

## Troubleshooting

### Form Submission Fails

**Check**:
1. API container is running: `docker ps | grep powernova-api`
2. API logs for errors: `docker logs powernova-api --tail 50`
3. Browser console for network errors
4. CORS configuration in API (should allow localhost:8080)

### Admin Dashboard Shows Empty

**Check**:
1. Admin key is correct
2. Browser console for 401 errors
3. Database has feedback entries: `docker exec powernova-postgres psql -U powernova -d powernova -c "SELECT COUNT(*) FROM feedback;"`
4. Status filter is set to "All"

### Status Updates Don't Work

**Check**:
1. Admin key authorization
2. Network tab shows PATCH request succeeded (200 OK)
3. Response contains updated feedback object
4. Browser console for errors

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ No API errors in logs  
✅ Database contains expected data  
✅ Admin dashboard updates in real-time  
✅ All CRUD operations work  
✅ Status transitions work correctly  
✅ Filter works for all statuses  
✅ Timestamps are accurate  
✅ Validation catches invalid inputs  

## Next Steps After Testing

Once all tests pass:

1. ✅ Mark feature as complete
2. ✅ Document in main README
3. ✅ Create user guide for admins
4. 📧 (Optional) Add email notifications
5. 📊 (Optional) Add analytics/reporting
6. 💾 (Optional) Add export functionality
7. 🏷️ (Optional) Add categories/tags
8. 🔔 (Optional) Add SLA tracking

## Test Results Template

Use this template to record your test results:

```
## Test Results - [Date]

### Landing Page Form
- [ ] Form submission works
- [ ] Success message appears
- [ ] Database entry created

### Admin Dashboard
- [ ] Feedback tab loads
- [ ] Stats are accurate
- [ ] Table shows feedback
- [ ] Filter works

### View Details
- [ ] Modal opens
- [ ] All fields populated
- [ ] Readonly fields can't be edited

### Status Changes
- [ ] New → In Progress works
- [ ] In Progress → Resolved works
- [ ] Resolved timestamp appears
- [ ] Stats update correctly

### Delete
- [ ] Confirmation dialog appears
- [ ] Deletion succeeds
- [ ] Entry removed from list
- [ ] Database entry deleted

### API Testing
- [ ] POST /api/feedback works
- [ ] GET /api/admin/feedback works
- [ ] GET /api/admin/feedback/stats works
- [ ] PATCH /api/admin/feedback/{id} works
- [ ] DELETE /api/admin/feedback/{id} works

### Validation
- [ ] Missing fields rejected
- [ ] Invalid email rejected
- [ ] Unauthorized access blocked

### Notes:
[Add any observations or issues here]
```
