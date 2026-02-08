import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyAw4ikfjaGQrDl_L-XNOkBTrWVTD1A-Ih0",
  authDomain: "mi-bitacora-auto.firebaseapp.com",
  projectId: "mi-bitacora-auto",
  storageBucket: "mi-bitacora-auto.firebasestorage.app",
  messagingSenderId: "670073950302",
  appId: "1:670073950302:web:10398465889e7fd5a164cf"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({})
});

export const DATA_COLLECTION = "mi-bitacora-v1";
