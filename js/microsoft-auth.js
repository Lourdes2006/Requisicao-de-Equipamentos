import {
  OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, ALLOWED_DOMAIN } from "./firebase-config.js";

const provider = new OAuthProvider("microsoft.com");
provider.setCustomParameters({ prompt: "select_account", tenant: "4334e4b0-48f4-4a76-ae54-cec847437a72" });
provider.addScope("openid");
provider.addScope("profile");
provider.addScope("email");

const button = document.getElementById("btnLoginMicrosoft");
const errorBox = document.getElementById("errorMessage");
let handlingAuth = false;

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.style.display = message ? "block" : "none";
}
function busy(value) {
  if (!button) return;
  button.disabled = value;
  button.textContent = value ? "A ligar à Microsoft…" : "Entrar com conta Microsoft";
}
function allowed(user) {
  const email = (user?.email || "").trim().toLowerCase();
  return email.endsWith("@" + ALLOWED_DOMAIN);
}
async function finishLogin(user) {
  if (!user || handlingAuth) return;
  handlingAuth = true;
  if (!allowed(user)) {
    await signOut(auth);
    showError(`Acesso permitido apenas a contas @${ALLOWED_DOMAIN}.`);
    busy(false);
    handlingAuth = false;
    return;
  }
  window.location.replace(new URL("dashboard.html", window.location.href).href);
}
async function login() {
  busy(true);
  showError("");
  try {
    const result = await signInWithPopup(auth, provider);
    await finishLogin(result.user);
  } catch (error) {
    console.error("Microsoft sign-in:", error);
    if (["auth/popup-blocked", "auth/operation-not-allowed-on-this-device"].includes(error.code)) {
      try { await signInWithRedirect(auth, provider); return; }
      catch (redirectError) { console.error(redirectError); }
    }
    const messages = {
      "auth/unauthorized-domain": "Este domínio ainda não está autorizado no Firebase Authentication.",
      "auth/operation-not-allowed": "Ativa o fornecedor Microsoft em Firebase → Authentication → Sign-in method.",
      "auth/invalid-oauth-client-id": "O Client ID Microsoft configurado no Firebase não é válido.",
      "auth/popup-closed-by-user": "A janela de autenticação foi fechada antes de terminar.",
      "auth/cancelled-popup-request": "Já existe uma janela de autenticação em curso."
    };
    showError(messages[error.code] || `Não foi possível iniciar sessão (${error.code || "erro desconhecido"}). Confirma a configuração Microsoft no Firebase.`);
    busy(false);
  }
}
button?.addEventListener("click", login);

getRedirectResult(auth).then(result => {
  if (result?.user) return finishLogin(result.user);
}).catch(error => {
  console.error("Microsoft redirect:", error);
  showError("Não foi possível concluir o acesso Microsoft. Confirma a configuração no Firebase.");
  busy(false);
});

onAuthStateChanged(auth, user => {
  if (user && !handlingAuth) finishLogin(user);
});
