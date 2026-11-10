// ======================================================
// EBJC EQUIPAMENTOS
// Firebase Authentication + Microsoft + Firestore
// ======================================================

import {
  signInWithPopup,
  OAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  auth,
  db,
  DOMINIO_AUTORIZADO,
  EMAIL_ADMIN
} from "./firebase.js";

console.log("EBJC: app.js carregado!");


// ======================================================
// FUNÇÕES GERAIS
// ======================================================

const el = id => document.getElementById(id);

const autorizado = user =>
  Boolean(
    user?.email &&
    user.email.toLowerCase().endsWith(
      "@" + DOMINIO_AUTORIZADO.toLowerCase()
    )
  );

const admin = user =>
  autorizado(user) &&
  user.email.toLowerCase() === EMAIL_ADMIN.toLowerCase();

function celulas(tr, valores) {
  valores.forEach(valor => {
    const td = document.createElement("td");
    td.textContent = valor ?? "-";
    tr.appendChild(td);
  });

  return tr;
}

function erro(error) {
  console.error(error);
  alert(error?.message || String(error));
}


// ======================================================
// LOGIN COM MICROSOFT
// ======================================================

const login = location.pathname.endsWith("/login.html");

const formLogin = el("formLogin");

if (formLogin) {
  formLogin.addEventListener("submit", async event => {
    event.preventDefault();

    const button = el("btnLoginFirebase");
    const msg = el("errorMessage");

    button.disabled = true;
    button.textContent = "A ligar à Microsoft...";

    if (msg) {
      msg.style.display = "none";
      msg.textContent = "";
    }

    try {
      const provider = new OAuthProvider("microsoft.com");

      provider.setCustomParameters({
        prompt: "select_account"
      });

      const result = await signInWithPopup(auth, provider);

      if (!autorizado(result.user)) {
        await signOut(auth);

        throw new Error(
          "Esta conta não pertence ao domínio autorizado da escola (@ebjc.pt)."
        );
      }

      location.replace("dashboard.html");

    } catch (error) {
      console.error("Erro no login Microsoft:", error);

      const mensagens = {
        "auth/popup-closed-by-user":
          "A janela de autenticação foi fechada antes de terminar.",

        "auth/popup-blocked":
          "O navegador bloqueou a janela. Permite pop-ups para este site.",

        "auth/unauthorized-domain":
          "O domínio do GitHub Pages não está autorizado no Firebase.",

        "auth/account-exists-with-different-credential":
          "Esta conta já está associada a outro método de autenticação.",

        "auth/operation-not-allowed":
          "O fornecedor Microsoft não está ativado no Firebase.",

        "auth/invalid-credential":
          "Não foi possível validar a autenticação Microsoft."
      };

      if (msg) {
        msg.textContent =
          mensagens[error.code] ||
          error.message ||
          "Não foi possível iniciar sessão.";

        msg.style.display = "block";
      } else {
        alert(mensagens[error.code] || error.message);
      }

    } finally {
      button.disabled = false;
      button.innerHTML =
        '<i class="fa-brands fa-microsoft"></i> Entrar com Microsoft';
    }
  });
}


// ======================================================
// TERMINAR SESSÃO
// ======================================================

document.querySelectorAll("#btnLogout").forEach(button => {
  button.addEventListener("click", async event => {
    event.preventDefault();

    try {
      await signOut(auth);
      location.replace("login.html");
    } catch (error) {
      erro(error);
    }
  });
});


// ======================================================
// AUTENTICAÇÃO E INICIALIZAÇÃO DAS PÁGINAS
// ======================================================

let utilizadorInicializado = null;

onAuthStateChanged(auth, async user => {

  if (!user) {
    utilizadorInicializado = null;

    if (!login) {
      location.replace("login.html");
    }

    return;
  }

  if (!autorizado(user)) {
    await signOut(auth);

    if (!login) {
      location.replace("login.html");
    }

    return;
  }

  if (login) {
    location.replace("dashboard.html");
    return;
  }

  if (utilizadorInicializado === user.uid) return;

  utilizadorInicializado = user.uid;

  // Dados do utilizador
  if (el("userName")) {
    el("userName").textContent =
      user.displayName || "Utilizador EPBJC";
  }

  if (el("userEmail")) {
    el("userEmail").textContent = user.email;
  }

  if (el("userInitial")) {
    el("userInitial").textContent =
      (user.displayName || user.email || "U")[0].toUpperCase();
  }

  // Esconder opções de administração dos restantes utilizadores
  document.querySelectorAll(
    'a[href="entregas.html"], a[href="devolucoes.html"]'
  ).forEach(link => {
    if (!admin(user)) {
      link.closest("li")?.remove();
    }
  });

  // Bloquear acesso às páginas de administração
  const paginasAdmin = [
    "entregas.html",
    "devolucoes.html"
  ];

  if (
    !admin(user) &&
    paginasAdmin.some(p => location.pathname.endsWith("/" + p))
  ) {
    location.replace("dashboard.html");
    return;
  }

  iniciarDashboard(user);
  iniciarPedidos(user);
  iniciarInventario();
  iniciarEntregas(user);
  iniciarDevolucoes(user);

});


// ======================================================
// DASHBOARD
// ======================================================

function iniciarDashboard(user) {

  const tabela = el("recentActivityTable");

  const referencia = collection(db, "requisicoes");

  const consulta = admin(user)
    ? referencia
    : query(
        referencia,
        where("email", "==", user.email)
      );

  onSnapshot(
    consulta,

    snapshot => {

      const pedidos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const estatisticas = [
        ["statTotal", null],
        ["statPendentes", "Pendente"],
        ["statAprovados", "Aprovado"],
        ["statEntregues", "Entregue"],
        ["statDevolvidos", "Devolvido"]
      ];

      estatisticas.forEach(([id, estado]) => {
        if (el(id)) {
          el(id).textContent = estado
            ? pedidos.filter(p => p.estado === estado).length
            : pedidos.length;
        }
      });

      if (tabela) {
        tabela.replaceChildren();

        pedidos
          .sort(
            (a, b) =>
              (b.createdAt?.seconds || 0) -
              (a.createdAt?.seconds || 0)
          )
          .slice(0, 5)
          .forEach(p => {
            tabela.appendChild(
              celulas(document.createElement("tr"), [
                p.idPedido || p.id,
                p.aluno,
                p.equipamento,
                p.dataPedido,
                p.estado
              ])
            );
          });
      }
    },

    error => console.error("Erro no dashboard:", error)
  );
}


// ======================================================
// NOVA REQUISIÇÃO E LISTA DE PEDIDOS
// ======================================================

function iniciarPedidos(user) {

  if (el("nomeAluno")) {
    el("nomeAluno").value =
      user.displayName || "Utilizador EPBJC";
  }

  if (el("emailAluno")) {
    el("emailAluno").value = user.email;
  }

  const form = el("formRequisicao");

  if (form) {
    form.addEventListener("submit", async event => {

      event.preventDefault();

      const inicio = el("dataLevantamento")?.value;
      const fim = el("dataDevolucao")?.value;
      const quantidade = Number(el("quantidade")?.value);

      const hoje = new Date();

      const hojeLocal =
        `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

      if (
        !inicio ||
        !fim ||
        inicio < hojeLocal ||
        fim < inicio ||
        !Number.isInteger(quantidade) ||
        quantidade < 1 ||
        quantidade > 3
      ) {
        alert("Confirma as datas e a quantidade (entre 1 e 3).");
        return;
      }

      const botao = form.querySelector('[type="submit"]');

      if (botao) botao.disabled = true;

      try {

        await addDoc(collection(db, "requisicoes"), {
          idPedido: "EPBJC-" + Date.now(),
          aluno: user.displayName || user.email,
          email: user.email,
          turma: el("turmaAluno")?.value || "",
          equipamento: el("equipamento")?.value || "",
          quantidade,
          dataPedido: hojeLocal,
          dataLevantamento: inicio,
          dataDevolucao: fim,
          finalidade: el("finalidade")?.value || "",
          observacoes: el("observacoes")?.value || "",
          estado: "Pendente",
          createdAt: serverTimestamp()
        });

        alert("Requisição submetida com sucesso!");
        location.href = "pedidos.html";

      } catch (error) {
        erro(error);

      } finally {
        if (botao) botao.disabled = false;
      }
    });
  }

  const tabela = el("tabelaPedidos");

  if (tabela) {

    const referencia = collection(db, "requisicoes");

    const consulta = admin(user)
      ? referencia
      : query(
          referencia,
          where("email", "==", user.email)
        );

    onSnapshot(
      consulta,

      snapshot => {
        tabela.replaceChildren();

        snapshot.forEach(d => {
          const p = d.data();

          tabela.appendChild(
            celulas(document.createElement("tr"), [
              p.idPedido || d.id,
              p.aluno,
              p.equipamento,
              p.quantidade,
              p.dataDevolucao,
              p.estado
            ])
          );
        });
      },

      erro
    );
  }
}


// ======================================================
// INVENTÁRIO
// ======================================================

function iniciarInventario() {

  const tabela = el("tabelaInventario");

  if (!tabela) return;

  onSnapshot(
    collection(db, "inventario"),

    snapshot => {

      tabela.replaceChildren();

      snapshot.forEach(d => {

        const p = d.data();

        tabela.appendChild(
          celulas(document.createElement("tr"), [
            d.id,
            p.nome,
            p.categoria,
            p.quantidadeTotal,
            p.quantidadeDisponivel,
            Number(p.quantidadeDisponivel) > 0
              ? "Disponível"
              : "Indisponível"
          ])
        );
      });
    },

    erro
  );
}


// ======================================================
// ENTREGAS — ADMINISTRADOR
// ======================================================

function iniciarEntregas(user) {

  if (!admin(user)) return;

  const tabela = el("tabelaEntregas");

  if (!tabela) return;

  onSnapshot(
    collection(db, "requisicoes"),

    snapshot => {

      tabela.replaceChildren();

      snapshot.forEach(d => {

        const p = d.data();

        if (!["Pendente", "Aprovado"].includes(p.estado)) {
          return;
        }

        const tr = celulas(document.createElement("tr"), [
          p.idPedido || d.id,
          p.aluno,
          p.equipamento,
          p.quantidade,
          p.estado
        ]);

        const td = document.createElement("td");
        const botao = document.createElement("button");

        botao.className = "btn";
        botao.textContent = "Marcar entregue";

        botao.addEventListener("click", async () => {

          if (!confirm("Confirmas a entrega deste equipamento?")) {
            return;
          }

          botao.disabled = true;

          try {

            await runTransaction(db, async transaction => {

              const referencia = doc(db, "requisicoes", d.id);
              const atual = await transaction.get(referencia);

              if (
                !atual.exists() ||
                !["Pendente", "Aprovado"].includes(atual.data().estado)
              ) {
                throw new Error("O estado do pedido foi alterado.");
              }

              transaction.update(referencia, {
                estado: "Entregue"
              });
            });

            alert("Entrega registada com sucesso!");

          } catch (error) {
            erro(error);

          } finally {
            botao.disabled = false;
          }
        });

        td.appendChild(botao);
        tr.appendChild(td);
        tabela.appendChild(tr);

      });
    },

    erro
  );
}


// ======================================================
// DEVOLUÇÕES — ADMINISTRADOR
// ======================================================

function iniciarDevolucoes(user) {

  if (!admin(user)) return;

  const tabela = el("tabelaDevolucoes");

  if (!tabela) return;

  onSnapshot(
    collection(db, "requisicoes"),

    snapshot => {

      tabela.replaceChildren();

      snapshot.forEach(d => {

        const p = d.data();

        if (p.estado !== "Entregue") return;

        const tr = celulas(document.createElement("tr"), [
          p.idPedido || d.id,
          p.aluno,
          p.equipamento,
          p.quantidade,
          p.estado
        ]);

        const td = document.createElement("td");
        const botao = document.createElement("button");

        botao.className = "btn";
        botao.textContent = "Registar devolução";

        botao.addEventListener("click", async () => {

          if (!confirm("Confirmas a devolução deste equipamento?")) {
            return;
          }

          botao.disabled = true;

          try {

            await runTransaction(db, async transaction => {

              const referencia = doc(db, "requisicoes", d.id);
              const atual = await transaction.get(referencia);

              if (
                !atual.exists() ||
                atual.data().estado !== "Entregue"
              ) {
                throw new Error("O estado do pedido foi alterado.");
              }

              transaction.update(referencia, {
                estado: "Devolvido"
              });
            });

            alert("Devolução registada com sucesso!");

          } catch (error) {
            erro(error);

          } finally {
            botao.disabled = false;
          }
        });

        td.appendChild(botao);
        tr.appendChild(td);
        tabela.appendChild(tr);

      });
    },

    erro
  );
}

