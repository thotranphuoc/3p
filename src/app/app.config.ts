import { ApplicationConfig, Injector, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp, FirebaseApp } from '@angular/fire/app';
import { provideFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

import { routes } from './app.routes';
import { firebaseConfig } from './firebase.config';

// Initialize Firestore with offline persistence
const firestoreFactory = (injector: Injector) => {
  const app = injector.get(FirebaseApp);
  const firestore = getFirestore(app);
  // Enable offline persistence as per spec requirement
  enableIndexedDbPersistence(firestore).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Firestore offline persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // Browser doesn't support persistence
      console.warn('Firestore offline persistence not supported in this browser');
    } else {
      console.error('Firestore offline persistence error:', err);
    }
  });
  return firestore;
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(firestoreFactory),
  ]
};
