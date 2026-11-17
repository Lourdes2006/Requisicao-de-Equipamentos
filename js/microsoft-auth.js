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
const provider = new OAuthProvider("microsoft.com");

// Solicita dados básicos do perfil Microsoft.
provider.setCustomParameters({ prompt: "select_account" });
provider.addScope("email");
provider.addScope("openid");
provider.addScope("profile");

function isInstitutionalAccount(user) {
  const email = (user?.email || "").trim().toLowerCase();
  return email.endsWith(ALLOWED_DOMAIN);
}

function showError(message) {
  let element = document.getElementById("loginError");
  if (!element) {
    element = document.createElement("p");
    element.id = "loginError";
    element.setAttribute("role", "alert");
    element.style.cssText = "color:#b00020;margin-top:12px";
    const button = document.getElementById("btnLoginMicrosoft")
      || document.getElementById("btnLoginFirebase");
    (button?.parentElement || document.body).appendChild(element);
  }
  element.textContent = message;
}

function setBusy(isBusy) {
  const buttons = [
    document.getElementById("btnLoginMicrosoft"),
    document.getElementById("btnLoginFirebase")
  ].filter(Boolean);
  buttons.forEach(button => {
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
  });
}

async function acceptOrReject(user) {
  if (!user) return false;

  if (!isInstitutionalAccount(user)) {
    await signOut(auth);
    showError(`Acesso permitido apenas a contas ${ALLOWED_DOMAIN}.`);
    return false;
  }

  window.location.replace(DASHBOARD_URL);
  return true;
}

async function loginMicrosoft() {
  setBusy(true);
  showError("");
  try {
    const result = await signInWithPopup(auth, provider);
    await acceptOrReject(result.user);
  } catch (error) {
    // Se o popup for bloqueado, usa o fluxo de redirecionamento.
    if (error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-browser") {
      await signInWithRedirect(auth, provider);
      return;
    }
    console.error("Erro no login Microsoft:", error);
    const messages = {
      "auth/unauthorized-domain": "Este domínio ainda não está autorizado nas definições do Firebase Authentication.",
      "auth/operation-not-allowed": "Ativa o fornecedor Microsoft no Firebase Authentication.",
      "auth/account-exists-with-different-credential": "Esta conta já está associada a outro método de autenticação."
    };
    showError(messages[error.code] || "Não foi possível iniciar sessão. Confirma a configuração Microsoft/Firebase e tenta novamente.");
  } finally {
    setBusy(false);
  }
}

// Liga o botão existente sem obrigar a alterar o desenho da página.
// Compatível com os dois IDs mencionados no projeto.
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("btnLoginMicrosoft")
    || document.getElementById("btnLoginFirebase");
  if (button) {
    button.addEventListener("click", event => {
      event.preventDefault();
      loginMicrosoft();
    });
  } else {
    console.warn("Não foi encontrado #btnLoginMicrosoft nem #btnLoginFirebase.");
  }
});

// Conclui o fluxo quando o Firebase regressa do login por redirecionamento.
getRedirectResult(auth).then(result => {
  if (result?.user) return acceptOrReject(result.user);
}).catch(error => {
  console.error("Erro no retorno Microsoft:", error);
  showError("Não foi possível concluir o login Microsoft. Verifica a configuração do fornecedor.");
});

// Mantém o utilizador autenticado apenas se tiver o domínio institucional.
onAuthStateChanged(auth, async user => {
  if (!user) return;
  if (!isInstitutionalAccount(user)) {
    await signOut(auth);
    showError(`Acesso permitido apenas a contas ${ALLOWED_DOMAIN}.`);
  }
});

// Disponibiliza logout para o resto da aplicação, se necessário.
window.logoutMicrosoft = () => signOut(auth);
