// Configuração da aplicação Firebase.
// Os valores abaixo são os que já estavam no projeto original.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC7JJgoIaz5VSm-3mYKrWSsujLjSnaUyMs",
  authDomain: "teste-epbjc-c022b.firebaseapp.com",
  projectId: "teste-epbjc-c022b",
  storageBucket: "teste-epbjc-c022b.firebasestorage.app",
  messagingSenderId: "526937413785",
  appId: "1:526937413785:web:3d825c5146a1ab9b300008",
  measurementId: "G-972X01LRXF"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Personaliza esta lista com os emails dos responsáveis pela gestão.
// Sem um email nesta lista, o utilizador entra como aluno.
export const ADMIN_EMAILS = [
  // "nome.apelido@epbjc.pt"
];

export const ALLOWED_DOMAIN = "alunos.epbjc.pt";
