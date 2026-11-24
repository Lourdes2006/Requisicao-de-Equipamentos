import { auth, db, ALLOWED_DOMAIN, ADMIN_EMAILS } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
const emailAllowed = user => (user?.email || "").toLowerCase().endsWith("@" + ALLOWED_DOMAIN);
const isAdmin = user => ADMIN_EMAILS.map(x => x.toLowerCase()).includes((user?.email || "").toLowerCase());
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const dateText = value => value?.toDate ? value.toDate().toLocaleDateString("pt-PT") : (value || "—");
const statusBadge = status => `<span class="badge ${escapeHTML((status || "pendente").toLowerCase())}">${escapeHTML(status || "Pendente")}</span>`;
let currentUser = null;
let requests = [];

function notify(message, error = false) {
  let box = $("appMessage");
  if (!box) {
    box = document.createElement("div");
    box.id = "appMessage";
    box.setAttribute("role", "status");
    box.style.cssText = "padding:12px;margin:12px 0;border-radius:8px;background:#172333;color:#fff";
    document.querySelector(".container")?.prepend(box);
  }
  box.textContent = message;
  box.style.border = error ? "1px solid #ef4444" : "1px solid #10b981";
}
function requireAuth(user) {
  if (!user) {
    window.location.replace("login.html");
    return false;
  }
  if (!emailAllowed(user)) {
    signOut(auth).finally(() => window.location.replace("login.html"));
    return false;
  }
  return true;
}
function renderUser(user) {
  if ($("userName")) $("userName").textContent = user.displayName || user.email.split("@")[0];
  if ($("userEmail")) $("userEmail").textContent = user.email || "";
  if ($("userInitial")) $("userInitial").textContent = (user.displayName || user.email || "A").charAt(0).toUpperCase();
  document.querySelectorAll("[data-admin-only]").forEach(el => el.hidden = !isAdmin(user));
}
async function loadRequests() {
  const base = collection(db, "requisicoes");
  let q;
  if (isAdmin(currentUser)) {
    q = query(base, orderBy("criadoEm", "desc"));
  } else {
    q = query(base, where("uid", "==", currentUser.uid));
  }
  const snap = await getDocs(q);
  requests = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  requests.sort((a,b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}
function row(r, actions = "") {
  return `<tr>
    <td>${escapeHTML(r.id.slice(0,8))}</td><td>${escapeHTML(r.nome || r.email || "")}</td>
    <td>${escapeHTML(r.equipamento)}</td><td>${escapeHTML(r.quantidade)}</td>
    <td>${escapeHTML(dateText(r.dataDevolucao || r.dataLevantamento))}</td>
    <td>${statusBadge(r.estado)}</td>${actions ? `<td>${actions}</td>` : ""}
  </tr>`;
}
function renderDashboard() {
  const count = status => requests.filter(r => (r.estado || "Pendente") === status).length;
  if ($("statTotal")) $("statTotal").textContent = requests.length;
  if ($("statPendentes")) $("statPendentes").textContent = count("Pendente");
  if ($("statAprovados")) $("statAprovados").textContent = count("Aprovado");
  if ($("statEntregues")) $("statEntregues").textContent = count("Entregue");
  if ($("statDevolvidos")) $("statDevolvidos").textContent = count("Devolvido");
  if ($("recentActivityTable")) $("recentActivityTable").innerHTML =
    requests.slice(0,8).map(r => `<tr><td>${escapeHTML(r.id.slice(0,8))}</td><td>${escapeHTML(r.nome)}</td><td>${escapeHTML(r.equipamento)}</td><td>${escapeHTML(dateText(r.criadoEm))}</td><td>${statusBadge(r.estado)}</td></tr>`).join("") ||
    '<tr><td colspan="5">Ainda não existem requisições.</td></tr>';
}
function renderOrders() {
  const target = $("tabelaPedidos");
  if (target) target.innerHTML = requests.map(r => row(r)).join("") || '<tr><td colspan="6">Não existem pedidos.</td></tr>';
  const deliveries = $("tabelaEntregas");
  if (deliveries) {
    const list = requests.filter(r => r.estado === "Aprovado");
    deliveries.innerHTML = list.map(r => row(r, isAdmin(currentUser) ? `<button class="btn" data-action="Entregue" data-id="${r.id}">Registar entrega</button>` : "—")).join("") || '<tr><td colspan="7">Não existem pedidos aprovados.</td></tr>';
  }
  const returns = $("tabelaDevolucoes");
  if (returns) {
    const list = requests.filter(r => r.estado === "Entregue");
    returns.innerHTML = list.map(r => row(r, isAdmin(currentUser) ? `<button class="btn" data-action="Devolvido" data-id="${r.id}">Registar devolução</button>` : "—")).join("") || '<tr><td colspan="7">Não existem equipamentos a aguardar devolução.</td></tr>';
  }
}
function renderInventory() {
  const target = $("tabelaInventario");
  if (!target) return;
  const items = ["Computador Portátil","Computador de Secretária","Monitor","Teclado / Rato","Auscultadores","Cabo HDMI / Adaptador","Projetor"];
  target.innerHTML = items.map((name,i) => {
    const pending = requests.filter(r => r.equipamento === name && ["Aprovado","Entregue"].includes(r.estado)).reduce((n,r)=>n+Number(r.quantidade||0),0);
    return `<tr><td>${i+1}</td><td>${name}</td><td>Informática</td><td>—</td><td>—</td><td>${pending} requisitado(s)</td></tr>`;
  }).join("");
}
async function submitRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const levantamento = $("dataLevantamento").value;
  const devolucao = $("dataDevolucao").value;
  const quantidade = Number($("quantidade").value);
  if (devolucao < levantamento) return notify("A data de devolução não pode ser anterior à data de levantamento.", true);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 3) return notify("A quantidade deve estar entre 1 e 3.", true);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await addDoc(collection(db, "requisicoes"), {
      uid: currentUser.uid, email: currentUser.email,
      nome: currentUser.displayName || currentUser.email.split("@")[0],
      turma: $("turmaAluno").value, equipamento: $("equipamento").value,
      quantidade, dataLevantamento: levantamento, dataDevolucao: devolucao,
      finalidade: $("finalidade").value.trim(), observacoes: $("observacoes").value.trim(),
      estado: "Pendente", criadoEm: serverTimestamp()
    });
    form.reset();
    notify("Requisição submetida com sucesso.");
    await refresh();
  } catch (error) {
    console.error(error);
    notify("Não foi possível guardar o pedido. Confirma as regras do Firestore.", true);
  } finally { button.disabled = false; }
}
async function updateStatus(id, status) {
  if (!isAdmin(currentUser)) return notify("Apenas os responsáveis autorizados podem alterar estados.", true);
  try {
    await updateDoc(doc(db, "requisicoes", id), { estado: status, atualizadoEm: serverTimestamp() });
    notify(`Pedido atualizado: ${status}.`);
    await refresh();
  } catch (error) {
    console.error(error);
    notify("Não foi possível atualizar. Verifica as regras de segurança do Firestore.", true);
  }
}
async function refresh() {
  await loadRequests();
  renderDashboard(); renderOrders(); renderInventory();
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (button) updateStatus(button.dataset.id, button.dataset.action);
});
$("formRequisicao")?.addEventListener("submit", submitRequest);
$("btnLogout")?.addEventListener("click", async event => {
  event.preventDefault();
  await signOut(auth);
  window.location.replace("login.html");
});

onAuthStateChanged(auth, async user => {
  if (!requireAuth(user)) return;
  currentUser = user;
  renderUser(user);
  if ($("nomeAluno")) $("nomeAluno").value = user.displayName || user.email.split("@")[0];
  if ($("emailAluno")) $("emailAluno").value = user.email || "";
  try { await refresh(); }
  catch (error) {
    console.error("Firestore:", error);
    notify("Não foi possível carregar os dados. Verifica as regras e a configuração do Firestore.", true);
  }
});
