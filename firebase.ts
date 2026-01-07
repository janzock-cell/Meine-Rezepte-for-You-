
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// WICHTIG: Ersetze diese Werte mit deinen eigenen Firebase-Daten!
// Anleitung:
// 1. Gehe auf console.firebase.google.com
// 2. Erstelle ein Projekt
// 3. Füge eine "Web App" hinzu (</> Icon)
// 4. Kopiere die "firebaseConfig" hier hinein.

const firebaseConfig = {
  apiKey: "DEIN_API_KEY_HIER_EINFÜGEN",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT_ID",
  storageBucket: "DEIN_PROJEKT.firebasestorage.app",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };
