import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, OAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Mantém aqui o teu firebaseConfig atual.

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const microsoftProvider = new OAuthProvider("microsoft.com");
const firebaseConfig = {
  apiKey: "AIzaSyC7JJgoIaz5VSm-3mYKrWSsujLjSnaUyMs",
  authDomain: "teste-epbjc-c022b.firebaseapp.com",
  projectId: "teste-epbjc-c022b",
  storageBucket: "teste-epbjc-c022b.firebasestorage.app",
  messagingSenderId: "526937413785",
  appId: "1:526937413785:web:3d825c5146a1ab9b300008",
  measurementId: "G-972X01LRXF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const DOMINIO_AUTORIZADO = "alunos.epbjc.pt";

//export const EMAIL_ADMIN = "O_TEU_EMAIL_DE_ADMINISTRADOR";
