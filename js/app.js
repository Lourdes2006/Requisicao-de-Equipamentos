import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  auth,
  db,
  microsoftProvider
} from "./firebase.js";

const botaoMicrosoft = document.getElementById("btnLoginMicrosoft");
const mensagemErro = document.getElementById("errorMessage");

if (botaoMicrosoft) {
  botaoMicrosoft.addEventListener("click", async () => {
    mensagemErro.textContent = "";
    botaoMicrosoft.disabled = true;
    botaoMicrosoft.textContent = "A ligar à Microsoft...";

    try {
      await signInWithRedirect(auth, microsoftProvider);
    } catch (erro) {
      mensagemErro.textContent = "Não foi possível iniciar sessão: " + erro.message;
      botaoMicrosoft.disabled = false;
      botaoMicrosoft.textContent = "Entrar com Microsoft";
    }
  });
}

try {
  const resultado = await getRedirectResult(auth);

  if (resultado?.user) {
    const email = resultado.user.email || "";

    if (!email.toLowerCase().endsWith("@ebjc.pt")) {
      mensagemErro.textContent = "Utiliza uma conta institucional da escola.";
      await auth.signOut();
    } else {
      window.location.href = "dashboard.html";
    }
  }
} catch (erro) {
  if (mensagemErro) {
    mensagemErro.textContent = "Erro de autenticação: " + erro.message;
  }
}
