import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Ces valeurs viennent de la console Firebase (Paramètres du projet > Vos applications > Config).
// Elles sont injectées via des variables d'environnement (voir .env.example) pour ne pas
// mettre tes vraies clés directement dans le code versionné sur GitHub.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
