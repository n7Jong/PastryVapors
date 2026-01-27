# Firebase Database Rules Setup Guide

## Firestore Security Rules

### How to Apply These Rules:

1. **Open Firebase Console**
   - Go to https://console.firebase.google.com/
   - Select your project "pastry-vapors"

2. **Navigate to Firestore Database**
   - Click "Firestore Database" in the left sidebar
   - Click the "Rules" tab at the top

3. **Copy and Paste Rules**
   - Open the `firestore.rules` file in this project
   - Copy all the contents
   - Paste into the Firebase Console rules editor
   - Click "Publish"

---

## Security Rules Explanation

### 🔐 Authentication Functions

```javascript
isAuthenticated() // User must be logged in
isAdmin()         // User must have role === 'admin' in users collection
isOwner(userId)   // User must own the resource
```

### 📋 Users Collection (`/users/{userId}`)

| Action | Who Can Do It | Conditions |
|--------|--------------|------------|
| **Read** | Any authenticated user | Needed to check roles |
| **Create** | Owner only | Can only create their own document |
| **Update** | Owner or Admin | Owner cannot change their role, only admin can |
| **Delete** | Admin only | Only admins can delete users |

**Example User Document:**
```javascript
{
  email: "promoter@pastryvapors.com",
  role: "admin" or "promoter",  // This is the isAdmin boolean check
  createdAt: timestamp,
  displayName: "John Doe" (optional)
}
```

---

### 📝 Posts Collection (`/posts/{postId}`)

| Action | Who Can Do It | Conditions |
|--------|--------------|------------|
| **Read** | Any authenticated user | Admins see all, promoters see their own |
| **Create** | Any authenticated user | Must set userId to their own ID, status must be 'pending', points must be 0 |
| **Update** | Admin OR Post owner | Admin can approve/reject. Owner can only edit their pending posts |
| **Delete** | Admin OR Post owner | Owner can only delete pending posts |

**Example Post Document:**
```javascript
{
  userId: "user-id-here",
  userEmail: "promoter@pastryvapors.com",
  platform: "facebook" or "instagram",
  postUrl: "https://facebook.com/...",
  status: "pending" or "approved" or "rejected",
  points: 0 (initially) or 150-200 (when approved),
  createdAt: timestamp,
  reviewedAt: timestamp (optional)
}
```

---

### 📊 Analytics Collection (Optional)

| Action | Who Can Do It |
|--------|--------------|
| **Read** | Admin only |
| **Write** | Admin only |

Use this collection to track:
- Total submissions per day
- Approval rates
- Top promoters
- Platform statistics

---

### ⚙️ Settings Collection (Optional)

| Action | Who Can Do It |
|--------|--------------|
| **Read** | Any authenticated user |
| **Write** | Admin only |

Use this collection for:
- Point values configuration
- Platform settings
- Feature flags
- Announcement messages

---

## Key Security Features

### ✅ What These Rules Prevent:

1. **Role Escalation**: Promoters cannot change their role to admin
2. **Point Manipulation**: Users cannot modify points on their posts
3. **Status Bypass**: Users cannot approve their own posts
4. **Data Theft**: Users can only read data they're authorized to see
5. **Unauthorized Deletion**: Only admins can delete approved/rejected posts

### ✅ What These Rules Allow:

1. **Admins**: Full control over posts (approve, reject, delete)
2. **Promoters**: Create and manage their own pending posts
3. **Role Checking**: All authenticated users can read user roles (needed for isAdmin check)
4. **Self-Management**: Users can update their own profile (except role)

---

## Testing Your Rules

### Test as Admin:
```javascript
// Admin can approve posts
service.collection('posts').doc('postId').update({
  status: 'approved',
  points: 150
}); // ✅ ALLOWED
```

### Test as Promoter:
```javascript
// Promoter can create post
service.collection('posts').add({
  userId: 'current-user-id',
  platform: 'facebook',
  postUrl: 'https://...',
  status: 'pending',
  points: 0
}); // ✅ ALLOWED

// Promoter tries to approve own post
service.collection('posts').doc('their-post').update({
  status: 'approved'
}); // ❌ DENIED
```

---

## Database Structure to Create

### 1. Create Users Collection

In Firestore Console:
1. Click "Start collection"
2. Collection ID: `users`
3. Add your first admin document:

**Document ID:** [Copy from Authentication > Users > User UID]

**Fields:**
- `email` (string): `admin@pastryvapors.com`
- `role` (string): `admin`
- `createdAt` (timestamp): [Current timestamp]

4. Add promoter document:

**Document ID:** [Promoter User UID]

**Fields:**
- `email` (string): `promoter@pastryvapors.com`
- `role` (string): `promoter`
- `createdAt` (timestamp): [Current timestamp]

### 2. Posts Collection

This will be created automatically when users submit their first post.

### 3. Analytics Collection (Optional)

Create manually if you want to track statistics:
- Collection ID: `analytics`
- Add documents as needed for tracking

### 4. Settings Collection (Optional)

Create for app configuration:
- Collection ID: `settings`
- Example document:

```javascript
{
  facebookPoints: 150,
  instagramPoints: 200,
  autoApprove: false,
  maintenanceMode: false
}
```

---

## Common Issues & Solutions

### Issue: "Missing or insufficient permissions"
**Solution**: Make sure you published the rules and the user has the correct role in the users collection.

### Issue: "User can't create posts"
**Solution**: Verify the userId in the post matches request.auth.uid and status is 'pending'.

### Issue: "Admin can't approve posts"
**Solution**: Check that the admin user has `role: 'admin'` in the users/{userId} document.

### Issue: "Rules simulator shows errors"
**Solution**: Use the Rules Playground in Firebase Console to test specific scenarios.

---

## Quick Apply Command

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

Or manually paste into Firebase Console > Firestore Database > Rules tab.

---

## Security Best Practices

1. ✅ **Always validate role on the server (Firestore rules)**
2. ✅ **Never trust client-side role checks alone**
3. ✅ **Keep rules simple and readable**
4. ✅ **Test rules thoroughly before production**
5. ✅ **Monitor usage in Firebase Console**
6. ✅ **Regularly review and update rules**

---

Your Firestore database is now secure with role-based access control! 🔒
