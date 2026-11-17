import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const ALLOWED_DOMAIN = "@alunos.epbjc.pt";
const DASHBOARD_URL = "./dashboard.html";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const TENANT_ID = "4334e4b0-48f4-4a76-ae54-cec847437a72";

const provider = new OAuthProvider("microsoft.com");

provider.setCustomParameters({
  prompt: "select_account",
  tenant: TENANT_ID
});
provider.setCustomParameters({ prompt: "select_account" });
provider.addScope("openid");
provider.addScope("profile");
provider.addScope("email");

function showError(message) {
  const element = document.getElementById("errorMessage");
  if (element) element.textContent = message;
  else console.error(message);
}

function setBusy(busy) {
  const button = document.getElementById("btnLoginMicrosoft");
  if (button) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.textContent = busy ? "A ligar à Microsoft…" : "Entrar com conta Microsoft";
  }
}

function hasInstitutionalDomain(user) {
  return (user?.email || "").trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

async function validateAndContinue(user) {
  if (!user) return;
  if (!hasInstitutionalDomain(user)) {
    await signOut(auth);
    showError("Acesso permitido apenas a contas " + ALLOWED_DOMAIN + ".");
    setBusy(false);
    return;
  }
  window.location.replace(DASHBOARD_URL);
}

async function loginMicrosoft() {
  setBusy(true);
  showError("");
  try {
    const result = await signInWithPopup(auth, provider);
    await validateAndContinue(result.user);
  } catch (error) {
    console.error("Erro no início de sessão Microsoft:", error);

    if (error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-browser") {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        console.error(redirectError);
        showError("Não foi possível abrir a autenticação Microsoft. Tenta novamente.");
      }
    } else {
      const messages = {
        "auth/unauthorized-domain": "Este endereço do site não está autorizado no Firebase Authentication.",
        "auth/operation-not-allowed": "O fornecedor Microsoft ainda não está ativado no Firebase Authentication.",
        "auth/invalid-oauth-client-id": "O Client ID Microsoft configurado no Firebase não é válido.",
        "auth/account-exists-with-different-credential": "Esta conta já está associada a outro método de autenticação."
      };
      showError(messages[error.code] || "Falha no início de sessão. Verifica a configuração Microsoft no Firebase e tenta novamente.");
    }
    setBusy(false);
  }
}

document.getElementById("btnLoginMicrosoft")?.addEventListener("click", loginMicrosoft);

getRedirectResult(auth).then(async result => {
  if (result?.user) await validateAndContinue(result.user);
}).catch(error => {
  console.error("Erro ao concluir autenticação Microsoft:", error);
  showError("Não foi possível concluir o início de sessão Microsoft. Verifica a configuração e tenta novamente.");
  setBusy(false);
});

// Se já existir uma sessão válida ao abrir login.html, encaminha para o painel.
onAuthStateChanged(auth, async user => {
  if (!user) return;
  await validateAndContinue(user);
});

// Pode ser chamado pelo botão de terminar sessão do resto da aplicação.
window.logoutMicrosoft = () => signOut(auth);
