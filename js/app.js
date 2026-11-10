
import { auth, db, DOMINIO_AUTORIZADO, EMAIL_ADMIN }
from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ======================================
// FUNÇÕES GERAIS
// ======================================

const el = id => document.getElementById(id);

const loginPage = location.pathname.endsWith("/login.html");

function autorizado(user) {
  return Boolean(
    user?.email &&
    user.email.toLowerCase().endsWith(
      "@" + DOMINIO_AUTORIZADO.toLowerCase()
    )
  );
}

function administrador(user) {
  return autorizado(user) &&
    user.email.toLowerCase() === EMAIL_ADMIN.toLowerCase();
}

function mostrarErro(texto) {
  const mensagem = el("errorMessage");

  if (mensagem) {
    mensagem.textContent = texto;
    mensagem.style.display = "block";
  } else {
    alert(texto);
  }
}

function adicionarCelulas(linha, valores) {
  valores.forEach(valor => {
    const td = document.createElement("td");
    td.textContent = valor ?? "-";
    linha.appendChild(td);
  });

  return linha;
}

function mostrarErroFirebase(error) {
  console.error("Firebase:", error);
  alert("Ocorreu um erro: " + (error.message || error));
}

// ======================================
// 1. LOGIN E AUTENTICAÇÃO
// ======================================

const formLogin = el("formLogin");

if (formLogin) {
  formLogin.addEventListener("submit", async event => {
    event.preventDefault();

    const botao = el("btnLoginFirebase");
    const email = el("loginEmail")?.value.trim();
    const password = el("loginPassword")?.value;

    if (!email || !password) {
      mostrarErro("Preenche o email e a palavra-passe.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "A verificar...";

    const mensagem = el("errorMessage");
    if (mensagem) mensagem.style.display = "none";

    try {
      const resultado = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (!autorizado(resultado.user)) {
        await signOut(auth);
        throw new Error(
          "Esta conta não pertence ao domínio institucional autorizado."
        );
      }

      location.replace("dashboard.html");

    } catch (error) {
      console.error(error);

      const erros = {
        "auth/invalid-credential": "Email ou palavra-passe incorretos.",
        "auth/user-not-found": "Utilizador não encontrado.",
        "auth/wrong-password": "Palavra-passe incorreta.",
        "auth/invalid-email": "O email não é válido.",
        "auth/too-many-requests": "Demasiadas tentativas. Tenta mais tarde.",
        "auth/network-request-failed": "Problema de ligação à Internet.",
        "auth/unauthorized-domain": "Domínio não autorizado no Firebase."
      };

      mostrarErro(
        erros[error.code] || error.message || "Erro ao iniciar sessão."
      );

    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar com Firebase";
    }
  });
}

// ======================================
// 2. TERMINAR SESSÃO
// ======================================

document.querySelectorAll("#btnLogout").forEach(botao => {
  botao.addEventListener("click", async event => {
    event.preventDefault();

    try {
      await signOut(auth);
      location.replace("login.html");
    } catch (error) {
      mostrarErroFirebase(error);
    }
  });
});

// ======================================
// 3. DASHBOARD E PROTEÇÃO DAS PÁGINAS
// ======================================

onAuthStateChanged(auth, async user => {

  if (!user || !autorizado(user)) {
    if (user) await signOut(auth);

    if (!loginPage) {
      location.replace("login.html");
    }
    return;
  }

  if (loginPage) {
    location.replace("dashboard.html");
    return;
  }

  if (location.pathname.endsWith("/index.html") ||
      location.pathname.endsWith("/")) {
    location.replace("dashboard.html");
    return;
  }

  const isAdmin = administrador(user);

  if (el("userName")) {
    el("userName").textContent = user.displayName || "Aluno EPBJC";
  }

  if (el("userEmail")) {
    el("userEmail").textContent = user.email;
  }

  if (el("userInitial")) {
    el("userInitial").textContent =
      (user.displayName || user.email)[0].toUpperCase();
  }

  // Ocultar opções administrativas dos alunos
  if (!isAdmin) {
    document.querySelectorAll(
      'a[href="entregas.html"], a[href="devolucoes.html"]'
    ).forEach(link => {
      link.closest("li")?.remove();
      link.remove();
    });

    if (
      location.pathname.endsWith("/entregas.html") ||
      location.pathname.endsWith("/devolucoes.html")
    ) {
      location.replace("dashboard.html");
      return;
    }
  }

  // ====================================
  // 4. DASHBOARD
  // ====================================

  const requisicoesRef = collection(db, "requisicoes");

  const consultaDashboard = isAdmin
    ? requisicoesRef
    : query(requisicoesRef, where("email", "==", user.email));

  if (
    el("statTotal") ||
    el("statPendentes") ||
    el("recentActivityTable")
  ) {
    onSnapshot(consultaDashboard, snapshot => {
      const pedidos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const estados = {
        statTotal: null,
        statPendentes: "Pendente",
        statAprovados: "Aprovado",
        statEntregues: "Entregue",
        statDevolvidos: "Devolvido"
      };

      Object.entries(estados).forEach(([id, estado]) => {
        if (el(id)) {
          el(id).textContent = estado
            ? pedidos.filter(p => p.estado === estado).length
            : pedidos.length;
        }
      });

      const tabela = el("recentActivityTable");

      if (tabela) {
        tabela.replaceChildren();

        pedidos
          .sort((a, b) =>
            (b.createdAt?.seconds || 0) -
            (a.createdAt?.seconds || 0)
          )
          .slice(0, 5)
          .forEach(p => {
            tabela.appendChild(
              adicionarCelulas(document.createElement("tr"), [
                p.idPedido || p.id,
                p.aluno,
                p.equipamento,
                p.dataPedido,
                p.estado
              ])
            );
          });
      }

    }, mostrarErroFirebase);
  }

  // ====================================
  // 5. PREENCHER DADOS DO ALUNO
  // ====================================

  if (el("nomeAluno")) {
    el("nomeAluno").value = user.displayName || "Aluno EPBJC";
  }

  if (el("emailAluno")) {
    el("emailAluno").value = user.email;
  }

  // ====================================
  // 6. NOVA REQUISIÇÃO
  // ====================================

  const formRequisicao = el("formRequisicao");

  if (formRequisicao) {
    formRequisicao.addEventListener("submit", async event => {
      event.preventDefault();

      const inicio = el("dataLevantamento").value;
      const fim = el("dataDevolucao").value;
      const quantidade = Number(el("quantidade").value);

      const hoje = new Date();
      const hojeLocal = [
        hoje.getFullYear(),
        String(hoje.getMonth() + 1).padStart(2, "0"),
        String(hoje.getDate()).padStart(2, "0")
      ].join("-");

      if (
        !inicio ||
        !fim ||
        inicio < hojeLocal ||
        fim < inicio ||
        !Number.isInteger(quantidade) ||
        quantidade < 1 ||
        quantidade > 3
      ) {
        alert("Verifica as datas e a quantidade (máximo 3).");
        return;
      }

      const botao = formRequisicao.querySelector(
        '[type="submit"]'
      );

      if (botao) botao.disabled = true;

      try {
        await addDoc(requisicoesRef, {
          idPedido: "EPBJC-" + Date.now(),
          aluno: user.displayName || "Aluno EPBJC",
          email: user.email,
          turma: el("turmaAluno").value,
          equipamento: el("equipamento").value,
          quantidade,
          dataPedido: hojeLocal,
          dataLevantamento: inicio,
          dataDevolucao: fim,
          finalidade: el("finalidade").value,
          observacoes: el("observacoes").value,
          estado: "Pendente",
          createdAt: serverTimestamp()
        });

        alert("Requisição enviada com sucesso!");
        location.href = "pedidos.html";

      } catch (error) {
        mostrarErroFirebase(error);

      } finally {
        if (botao) botao.disabled = false;
      }
    });
  }

  // ====================================
  // 7. CONSULTAR PEDIDOS
  // ====================================

  const tabelaPedidos = el("tabelaPedidos");

  if (tabelaPedidos) {
    onSnapshot(consultaDashboard, snapshot => {
      tabelaPedidos.replaceChildren();

      snapshot.forEach(d => {
        const p = d.data();

        const linha = adicionarCelulas(
          document.createElement("tr"),
          [
            p.idPedido || d.id,
            p.aluno,
            p.equipamento,
            p.quantidade,
            p.dataDevolucao,
            p.estado
          ]
        );

        if (isAdmin) {
          const td = document.createElement("td");

          if (p.estado === "Pendente") {
            const aprovar = document.createElement("button");
            aprovar.textContent = "Aprovar";
            aprovar.className = "btn";

            aprovar.onclick = () =>
              alterarEstado(d.id, "Pendente", "Aprovado");

            const rejeitar = document.createElement("button");
            rejeitar.textContent = "Rejeitar";
            rejeitar.className = "btn";

            rejeitar.onclick = () =>
              alterarEstado(d.id, "Pendente", "Rejeitado");

            td.append(aprovar, rejeitar);
          }

          linha.appendChild(td);
        }

        tabelaPedidos.appendChild(linha);
      });

    }, mostrarErroFirebase);
  }

  // ====================================
  // 8. ALTERAR ESTADO DOS PEDIDOS
  // ====================================

  async function alterarEstado(id, estadoAtual, novoEstado) {
    if (!isAdmin) {
      alert("Não tens autorização para esta operação.");
      return;
    }

    if (!confirm("Confirmas esta operação?")) return;

    try {
      await runTransaction(db, async transaction => {
        const referencia = doc(db, "requisicoes", id);
        const pedido = await transaction.get(referencia);

        if (!pedido.exists()) {
          throw new Error("Pedido não encontrado.");
        }

        if (pedido.data().estado !== estadoAtual) {
          throw new Error("O estado do pedido já foi alterado.");
        }

        transaction.update(referencia, {
          estado: novoEstado,
          atualizadoEm: serverTimestamp()
        });
      });

      alert("Pedido atualizado com sucesso!");

    } catch (error) {
      mostrarErroFirebase(error);
    }
  }

  // ====================================
  // 9. INVENTÁRIO
  // ====================================

  const tabelaInventario = el("tabelaInventario");

  if (tabelaInventario) {
    onSnapshot(collection(db, "inventario"), snapshot => {
      tabelaInventario.replaceChildren();

      snapshot.forEach(d => {
        const p = d.data();

        tabelaInventario.appendChild(
          adicionarCelulas(document.createElement("tr"), [
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

    }, mostrarErroFirebase);
  }

  // ====================================
  // 10. ENTREGAS
  // ====================================

  const tabelaEntregas = el("tabelaEntregas");

  if (tabelaEntregas && isAdmin) {
    onSnapshot(requisicoesRef, snapshot => {
      tabelaEntregas.replaceChildren();

      snapshot.forEach(d => {
        const p = d.data();

        if (p.estado !== "Aprovado") return;

        const linha = adicionarCelulas(
          document.createElement("tr"),
          [
            p.idPedido || d.id,
            p.aluno,
            p.equipamento,
            p.quantidade,
            p.estado
          ]
        );

        const td = document.createElement("td");
        const botao = document.createElement("button");

        botao.className = "btn";
        botao.textContent = "Marcar entregue";

        botao.onclick = async () => {
          if (!confirm("Confirmar entrega do equipamento?")) return;

          botao.disabled = true;

          try {
            await alterarEstado(d.id, "Aprovado", "Entregue");
          } finally {
            botao.disabled = false;
          }
        };

        td.appendChild(botao);
        linha.appendChild(td);
        tabelaEntregas.appendChild(linha);
      });

    }, mostrarErroFirebase);
  }

  // ====================================
  // 11. DEVOLUÇÕES
  // ====================================

  const tabelaDevolucoes = el("tabelaDevolucoes");

  if (tabelaDevolucoes && isAdmin) {
    onSnapshot(requisicoesRef, snapshot => {
      tabelaDevolucoes.replaceChildren();

      snapshot.forEach(d => {
        const p = d.data();

        if (p.estado !== "Entregue") return;

        const linha = adicionarCelulas(
          document.createElement("tr"),
          [
            p.idPedido || d.id,
            p.aluno,
            p.equipamento,
            p.quantidade,
            p.estado
          ]
        );

        const td = document.createElement("td");
        const botao = document.createElement("button");

        botao.className = "btn";
        botao.textContent = "Registar devolução";

        botao.onclick = async () => {
          if (!confirm("Confirmar devolução do equipamento?")) return;

          botao.disabled = true;

          try {
            await alterarEstado(d.id, "Entregue", "Devolvido");
          } finally {
            botao.disabled = false;
          }
        };

        td.appendChild(botao);
        linha.appendChild(td);
        tabelaDevolucoes.appendChild(linha);
      });

    }, mostrarErroFirebase);
  }

});
