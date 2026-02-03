# Setup Guide - Project Management PWA

## Prerequisites
- Node.js (v18+)
- npm or yarn
- Firebase account

## Installation Steps

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd "Project Management PWA"
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Firebase

#### Option A: Copy from example file
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts
```

#### Option B: Create your own Firebase project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Go to Project Settings > General > Your apps
4. Copy your Firebase configuration
5. Update `src/environments/environment.ts` and `src/environments/environment.prod.ts` with your config

Example configuration:
```typescript
export const environment = {
  production: false, // true for environment.prod.ts
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  }
};
```

### 4. Run the development server
```bash
npm start
```

Navigate to `http://localhost:4200/`

## Build for Production
```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Firebase Deployment (Optional)

If you want to deploy to Firebase Hosting:

1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

2. Login to Firebase
```bash
firebase login
```

3. Initialize Firebase (if not already done)
```bash
firebase init
```

4. Deploy
```bash
npm run build
firebase deploy
```

## Important Security Notes

⚠️ **NEVER commit the following files to Git:**
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`
- `.firebaserc`
- `firebase.json`

These files are already in `.gitignore` to prevent accidental commits.

## Project Structure
```
src/
├── app/
│   ├── components/     # Reusable UI components
│   ├── guards/         # Route guards (auth, admin)
│   ├── models/         # Data models
│   ├── pages/          # Page components
│   ├── services/       # Business logic services
│   └── firebase.config.ts
├── environments/       # Environment configurations
└── assets/            # Static assets
```

## Features
- User authentication (Firebase Auth)
- Project management with Kanban board
- Task and subtask management
- Time tracking with global timer
- Admin user management
- Responsive design with Tailwind CSS
