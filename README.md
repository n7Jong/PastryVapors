# Pastry Vapors - Promoter Monitoring System

A modern web application for monitoring and managing promoter activities with Firebase integration.

## Features

### 🔐 Authentication System
- Multi-role login (Admin, Promoter, Guest)
- Email/Password authentication via Firebase
- Demo mode for quick testing

### 👤 Promoter Dashboard
- Submit Facebook and Instagram post links
- Track submission history
- View approval status and earned points
- Real-time statistics (Total Points, Approved Posts, Pending Review)

### 👨‍💼 Admin Dashboard
- Review all promoter submissions
- Approve or reject posts
- Filter by status (All, Pending, Approved, Rejected)
- Automatic point allocation
- Comprehensive statistics

## Technologies Used

- **HTML5** - Semantic markup
- **Tailwind CSS** - Utility-first styling
- **Firebase** - Backend services
  - Authentication
  - Firestore Database
- **Font Awesome** - Icons
- **Vanilla JavaScript (ES6 Modules)** - Client-side logic

## Project Structure

```
PastryVapors/
├── index.html                  # Login page
├── promoter-dashboard.html     # Promoter interface
├── admin-dashboard.html        # Admin interface
├── firebase-config.js          # Firebase configuration
├── app.js                      # Login logic
├── promoter.js                 # Promoter dashboard logic
├── admin.js                    # Admin dashboard logic
└── README.md                   # This file
```

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password authentication
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
5. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll to "Your apps" section
   - Click on Web app icon (</>) or add new web app
   - Copy the configuration object

### 2. Configure Firebase

Open `firebase-config.js` and replace the placeholder values with your Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Firestore Database Structure

Create the following collections in Firestore:

#### Collection: `users`
```
{
  userId: {
    email: "user@example.com",
    role: "admin" | "promoter" | "guest",
    createdAt: timestamp
  }
}
```

#### Collection: `posts`
```
{
  postId: {
    userId: "user-id",
    userEmail: "user@example.com",
    platform: "facebook" | "instagram",
    postUrl: "https://...",
    status: "pending" | "approved" | "rejected",
    points: 0 | 150-200,
    createdAt: timestamp,
    reviewedAt: timestamp (optional)
  }
}
```

### 4. Firestore Security Rules

Add these security rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Posts collection
    match /posts/{postId} {
      // Admins can read/write all posts
      allow read: if request.auth != null;
      
      // Users can only create their own posts
      allow create: if request.auth != null && 
                      request.resource.data.userId == request.auth.uid;
      
      // Only admins can update posts (for approval/rejection)
      allow update: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // Users can delete their own posts
      allow delete: if request.auth != null && 
                      resource.data.userId == request.auth.uid;
    }
  }
}
```

### 5. Create Demo Accounts

In Firebase Authentication, create these demo accounts:

1. **Admin Account**
   - Email: `admin@pastryvapors.com`
   - Password: `admin123`
   - Create user document in Firestore:
     ```
     users/[userId] = { email: "admin@pastryvapors.com", role: "admin" }
     ```

2. **Promoter Account**
   - Email: `promoter@pastryvapors.com`
   - Password: `promoter123`
   - Create user document:
     ```
     users/[userId] = { email: "promoter@pastryvapors.com", role: "promoter" }
     ```

3. **Guest Account**
   - Email: `guest@pastryvapors.com`
   - Password: `guest123`
   - Create user document:
     ```
     users/[userId] = { email: "guest@pastryvapors.com", role: "guest" }
     ```

### 6. Run the Application

1. **Using a local web server (Recommended):**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

2. **Open in browser:**
   - Navigate to `http://localhost:8000`
   - Click on one of the demo login buttons OR
   - Enter credentials manually

## Demo Mode

The application includes a demo mode that works without Firebase:
- Click "Login as Admin", "Login as Promoter", or "Login as Guest"
- Data is stored in localStorage
- Perfect for testing and demonstration

## Usage

### For Promoters:
1. Login with promoter credentials
2. Select platform (Facebook or Instagram)
3. Paste post URL
4. Click "Submit Post"
5. View submission history and points

### For Admins:
1. Login with admin credentials
2. View all pending submissions
3. Click "Approve" or "Reject" on each post
4. Approved posts automatically receive 150-200 points
5. Use filter tabs to view different status categories

## Points System

- Facebook posts: 150-200 points (randomly assigned on approval)
- Instagram posts: 150-200 points (randomly assigned on approval)
- Rejected posts: 0 points
- Pending posts: 0 points (until reviewed)

## Color Scheme

- Primary: Bright Gold (#EAB308 - yellow-500 / amber-500)
- Background: Dark gradient (#0a0a0a to #1a1a1a)
- Cards: Dark with glass effect
- Status Colors:
  - Pending: Yellow
  - Approved: Green
  - Rejected: Red

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Firebase Errors
- Ensure Firebase config is correct
- Check if Authentication is enabled
- Verify Firestore security rules
- Check browser console for detailed errors

### CORS Issues
- Always use a local web server (don't open HTML files directly)
- Ensure Firebase domain is authorized in Firebase Console

### Login Issues
- Verify demo accounts exist in Firebase Authentication
- Check user role in Firestore users collection
- Clear localStorage and try again

## Future Enhancements

- [ ] Email notifications for promoters
- [ ] Advanced analytics dashboard
- [ ] Bulk approval/rejection
- [ ] Export reports to CSV/PDF
- [ ] Profile management
- [ ] Password reset functionality
- [ ] Multi-language support
- [ ] Mobile app version

## License

This project is created for Pastry Vapors promoter monitoring system.

## Support

For issues or questions, contact the administrator.
