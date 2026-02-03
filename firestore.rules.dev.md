# Firestore Security Rules - Development Mode

## Quick Setup for Development

For development/testing, you can use these simpler rules that allow authenticated users to read/write:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads/writes for authenticated users (DEVELOPMENT ONLY)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Production Rules

See `firestore.rules` for production-ready rules that follow the spec requirements.

## How to Deploy Rules

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize (if not done): `firebase init firestore`
4. Deploy rules: `firebase deploy --only firestore:rules`

## Testing Rules Locally

1. Start emulator: `firebase emulators:start --only firestore`
2. Update `firebase.config.ts` to use emulator in development
3. Test your app against emulator
