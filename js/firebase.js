import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "A_TUA_API_KEY",
  authDomain: "teste-epbjc-c022b.firebaseapp.com",
  projectId: "teste-epbjc-c022b",
  storageBucket: "teste-epbjc-c022b.firebasestorage.app",
  messagingSenderId: "526937413785",
  appId: "1:526937413785:web:3d825c5146a1ab9b300008"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const DOMINIO_AUTORIZADO = "ebjc.pt";
export const EMAIL_ADMIN = "O_TEU_EMAIL_DE_ADMINISTRADOR";
