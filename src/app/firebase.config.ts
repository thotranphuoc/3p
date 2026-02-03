import { FirebaseOptions } from 'firebase/app';
import { environment } from '../environments/environment';

// Firebase configuration is now loaded from environment files
// This allows different configs for development and production
export const firebaseConfig: FirebaseOptions = environment.firebase;
