// Copy this file to environment.ts and fill in your Firebase configuration
// Get these values from Firebase Console > Project Settings > General > Your apps

import { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  } as FirebaseOptions
};
