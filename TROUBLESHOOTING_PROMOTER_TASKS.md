# Troubleshooting Guide: Why Promoters Cannot Submit Tasks

## Common Issues and Solutions

### 1. ⚠️ INCOMPLETE PROFILE (Most Common)
**Symptom:** Promoters see a red banner on their dashboard and cannot submit tasks.

**Cause:** Missing required profile fields.

**Required Fields:**
- ✅ First Name
- ✅ Last Name
- ✅ Email
- ✅ Birthdate
- ✅ Address
- ✅ Contact Number
- ✅ Gender
- ✅ Primary Facebook Link
- ✅ Profile Picture (not placeholder)

**Solution for Promoters:**
1. Click "User Profile" in the navigation bar
2. Fill in ALL missing fields
3. Upload a real profile picture (not the default avatar)
4. Click "Save Changes"
5. Return to dashboard and try submitting again

**Admin Check:**
1. Go to "Manage Promoters"
2. Find the promoter having issues
3. Check if all fields are filled
4. If fields are missing, contact the promoter to complete their profile

---

### 2. ⛔ ACCOUNT SUSPENDED
**Symptom:** Promoter sees suspension message on dashboard.

**Cause:** Admin has suspended the account.

**Solution for Admin:**
1. Go to "Manage Promoters"
2. Find the suspended promoter
3. Click "Actions" → "Remove Suspension"
4. Promoter can now submit tasks

**Note:** Suspensions automatically expire based on the set date.

---

### 3. 🔒 MISSING USER DOCUMENT
**Symptom:** Promoter can log in but nothing loads or gets errors.

**Cause:** User document not created properly in Firestore.

**Solution (Now Auto-Fixed):**
The system now automatically creates missing user documents when promoters log in. If issues persist:

**Manual Fix (Admin):**
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check if user document exists in `users` collection
4. If missing, the promoter should:
   - Log out completely
   - Log in again
   - System will auto-create their document

---

### 4. 📅 NOT THEIR POSTING DAY
**Symptom:** Submit form is grayed out with message "Not Your Posting Day"

**Cause:** Promoter trying to submit on non-scheduled days.

**Solution:**
- This is NORMAL behavior
- Promoters can only submit on their assigned days
- Check their schedule in the dashboard message

**Admin Check:**
1. Verify the promoter's assigned schedule
2. Ensure schedule settings are correct
3. Adjust if needed

---

### 5. ⚠️ WARNINGS ISSUED
**Symptom:** Yellow banner appears on promoter dashboard.

**Cause:** Admin has issued warnings for policy violations.

**Effect:** 
- Promoters CAN still submit tasks
- Banner is just a notice
- After 3 warnings, admin should consider suspension

**Admin Actions:**
1. Monitor promoters with warnings
2. Clear warnings if behavior improves
3. Suspend account if violations continue

---

## Visual Status Indicators

### In Promoter Dashboard:
- 🟢 **✓ ACTIVE** - Profile complete, can submit tasks
- 🟠 **⚠ INCOMPLETE** - Missing profile fields
- 🔴 **⛔ SUSPENDED** - Account suspended

### Profile Completion Banner:
- Shows list of missing fields
- Link to complete profile
- Can be minimized (returns on reload if still incomplete)

---

## Quick Diagnostic Checklist

When a promoter reports they cannot submit tasks:

1. **Ask them to check their dashboard:**
   - [ ] Is there a RED banner about incomplete profile?
   - [ ] Is there a suspension message?
   - [ ] Is the submit form grayed out?
   - [ ] What does their status badge say? (ACTIVE/INCOMPLETE/SUSPENDED)

2. **Check as Admin:**
   - [ ] Go to "Manage Promoters"
   - [ ] Find the promoter
   - [ ] Check their status (Active/Suspended)
   - [ ] Check warning count
   - [ ] Verify all profile fields are complete

3. **Common Quick Fixes:**
   - Profile incomplete → Tell them to complete User Profile
   - Suspended → Remove suspension if appropriate
   - Wrong day → Explain posting schedule
   - Missing document → Have them re-login

---

## Prevention Tips

### For Admins:
1. ✅ Enable signup only when ready to onboard
2. ✅ Require profile completion during first login
3. ✅ Monitor new promoters' first submissions
4. ✅ Clear communication about schedules and rules

### For Promoters:
1. ✅ Complete profile IMMEDIATELY after signup
2. ✅ Upload a real profile picture
3. ✅ Check dashboard status badge regularly
4. ✅ Read all warning notices
5. ✅ Respect posting schedules

---

## Recent Improvements (Applied Today)

✅ **Enhanced Profile Validation**
- Now shows EXACTLY which fields are missing
- Clear, actionable error messages

✅ **Visual Status Indicators**
- Status badge in navigation bar
- Color-coded banners on dashboard

✅ **Auto-Document Creation**
- Missing user documents now auto-created
- Prevents login issues

✅ **Profile Incomplete Banner**
- Shows at top of dashboard
- Lists all missing fields
- Direct link to profile page
- Can be minimized temporarily

---

## Support Contact

If issues persist after trying these solutions:
1. Check Firebase Console for errors
2. Review Firestore security rules
3. Check browser console for JavaScript errors
4. Verify internet connectivity

For technical support, contact the development team.

---

**Last Updated:** January 31, 2026
**System Version:** 2.0 (Enhanced Profile Validation)
