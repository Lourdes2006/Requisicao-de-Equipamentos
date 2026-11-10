
// ======================================================
// EBJC EQUIPAMENTOS
// Lógica de todas as páginas
// Firebase Authentication + Cloud Firestore
// ======================================================

import {
  signInWithEmailAndPassword,
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
  for (const valor of valores) {
    const td = document.createElement("td");
    td.textContent = valor ?? "-";
    tr.appendChild(td);
  }
  return tr;
}

function erro(error) {
  console.error(error);
  alert(error?.message || String(error));
}


// ======================================================
// AUTENTICAÇÃO E LOGIN
// ======================================================

const login = location.pathname.endsWith("/login.html");
const formLogin = el("formLogin");

if (formLogin) {
  formLogin.addEventListener("submit", async event => {
    event.preventDefault();

    const button = el("btnLoginFirebase");
    const msg = el("errorMessage");
    const email = el("loginEmail")?.value.trim();
    const password = el("loginPassword")?.value;

    if (!email || !password) {
      msg.textContent = "Preenche o email e a palavra-passe.";
      msg.style.display = "block";
      return;
    }

    button.disabled = true;
    button.textContent = "A entrar...";
    msg.style.display = "none";

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (!autorizado(result.user)) {
        await signOut(auth);
        throw new Error(
          "Esta conta não pertence ao domínio institucional @ebjc.pt."
        );
      }

      location.replace("dashboard.html");

    } catch (error) {
      console.error("Erro no login:", error);

      const mensagens = {
        "auth/invalid-credential": "Email ou palavra-passe incorretos.",
        "auth/user-not-found": "Não existe uma conta com esse email.",
        "auth/wrong-password": "A palavra-passe está incorreta.",
        "auth/invalid-email": "O email introduzido não é válido.",
        "auth/too-many-requests": "Demasiadas tentativas. Tenta novamente mais tarde.",
        "auth/network-request-failed": "Erro de ligação à Internet.",
        "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase."
      };

      msg.textContent =
        mensagens[error.code] || error.message || "Não foi possível iniciar sessão.";

      msg.style.display = "block";

    } finally {
      button.disabled = false;
      button.textContent = "Entrar com Firebase";
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
// VERIFICAR UTILIZADOR AUTENTICADO
// ======================================================

let paginaInicializada = false;

onAuthStateChanged(auth, async user => {
  if (!autorizado(user)) {
    paginaInicializada = false;

    if (user) {
      await signOut(auth);
    }

    if (!login) {
      location.replace("login.html");
    }

    return;
  }

  if (login) {
    location.replace("dashboard.html");
    return;
  }

  if (paginaInicializada) return;
  paginaInicializada = true;

  if (el("userName")) {
    el("userName").textContent =
      user.displayName || "Aluno EPBJC";
  }

  if (el("userEmail")) {
    el("userEmail").textContent = user.email;
  }

  if (el("userInitial")) {
    el("userInitial").textContent =
      (user.displayName || user.email || "A")[0].toUpperCase();
  }

  // Esconder páginas de administração dos alunos
  document.querySelectorAll(
    'a[href="entregas.html"], a[href="devolucoes.html"]'
  ).forEach(link => {
    if (!admin(user)) {
      link.closest("li")?.remove();
    }
  });

  // Impedir acesso às páginas de administração
  if (
    !admin(user) &&
    ["entregas.html", "devolucoes.html"].some(
      page => location.pathname.endsWith("/" + page)
    )
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

  const ref = collection(db, "requisicoes");

  const consulta = admin(user)
    ? ref
    : query(ref, where("email", "==", user.email));

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
          .forEach(pedido => {
            tabela.appendChild(
              celulas(document.createElement("tr"), [
                pedido.idPedido || pedido.id,
                pedido.aluno,
                pedido.equipamento,
                pedido.dataPedido,
                pedido.estado
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
    el("nomeAluno").value = user.displayName || "Aluno EPBJC";
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
          aluno: user.displayName || "Aluno EPBJC",
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
    const ref = collection(db, "requisicoes");

    const consulta = admin(user)
      ? ref
      : query(ref, where("email", "==", user.email));

    onSnapshot(
      consulta,
      snapshot => {
        tabela.replaceChildren();

        snapshot.forEach(d => {
          const pedido = d.data();

          tabela.appendChild(
            celulas(document.createElement("tr"), [
              pedido.idPedido || d.id,
              pedido.aluno,
              pedido.equipamento,
              pedido.quantidade,
              pedido.dataDevolucao,
              pedido.estado
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
        const item = d.data();

        tabela.appendChild(
          celulas(document.createElement("tr"), [
            d.id,
            item.nome,
            item.categoria,
            item.quantidadeTotal,
            item.quantidadeDisponivel,
            Number(item.quantidadeDisponivel) > 0
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
// ENTREGAS — APENAS ADMINISTRADOR
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
        const pedido = d.data();

        if (!["Pendente", "Aprovado"].includes(pedido.estado)) {
          return;
        }

        const tr = celulas(document.createElement("tr"), [
          pedido.idPedido || d.id,
          pedido.aluno,
          pedido.equipamento,
          pedido.quantidade,
          pedido.estado
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
                throw new Error("O estado deste pedido foi alterado.");
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
// DEVOLUÇÕES — APENAS ADMINISTRADOR
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
        const pedido = d.data();

        if (pedido.estado !== "Entregue") {
          return;
        }

        const tr = celulas(document.createElement("tr"), [
          pedido.idPedido || d.id,
          pedido.aluno,
          pedido.equipamento,
          pedido.quantidade,
          pedido.estado
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
                throw new Error("O estado deste pedido foi alterado.");
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
