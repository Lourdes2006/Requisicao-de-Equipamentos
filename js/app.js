// EPBJC — Lógica de todas as páginas, apenas Firebase Authentication + Firestore.
import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {getFirestore,collection,addDoc,serverTimestamp,onSnapshot,query,where,doc,runTransaction} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {firebaseConfig,DOMINIO_AUTORIZADO,EMAIL_ADMIN} from "./firebase.js";
// ===== core.js =====
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);const db=getFirestore(app);
const autorizado=u=>Boolean(u?.email&&u.email.toLowerCase().endsWith("@"+DOMINIO_AUTORIZADO.toLowerCase()));
const admin=u=>autorizado(u)&&u.email.toLowerCase()===EMAIL_ADMIN.toLowerCase();
const el=id=>document.getElementById(id);
function celulas(tr,valores){for(const v of valores){const td=document.createElement('td');td.textContent=v??'-';tr.append(td)}return tr}
function erro(e){console.error(e);alert(e?.message||String(e))}


// ===== auth.js =====
const login=location.pathname.endsWith('/login.html');
const form=el('formLogin');
form?.addEventListener('submit',async event=>{event.preventDefault();const button=el('btnLoginFirebase'),msg=el('errorMessage');button.disabled=true;msg.style.display='none';try{const result=await signInWithEmailAndPassword(auth,el('loginEmail').value.trim(),el('loginPassword').value);if(!autorizado(result.user)){await signOut(auth);throw new Error('Conta não autorizada para esta escola.')}location.replace('dashboard.html')}catch(e){msg.textContent=e.code==='auth/invalid-credential'?'Email ou palavra-passe incorretos.':e.message;msg.style.display='block'}finally{button.disabled=false}});
document.querySelectorAll('#btnLogout').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();await signOut(auth);location.replace('login.html')}));
onAuthStateChanged(auth,async user=>{if(!autorizado(user)){if(user)await signOut(auth);if(!login)location.replace('login.html');return}if(login){location.replace('dashboard.html');return}if(el('userName'))el('userName').textContent=user.displayName||'Aluno EPBJC';if(el('userEmail'))el('userEmail').textContent=user.email;if(el('userInitial'))el('userInitial').textContent=(user.displayName||'A')[0].toUpperCase();document.querySelectorAll('a[href="entregas.html"],a[href="devolucoes.html"]').forEach(a=>{if(!admin(user))a.closest('li')?.remove()});if(!admin(user)&&['entregas.html','devolucoes.html'].some(p=>location.pathname.endsWith('/'+p)))location.replace('dashboard.html')});


// ===== app.js =====
onAuthStateChanged(auth,user=>{if(!user)return;const ref=collection(db,'requisicoes');const q=admin(user)?ref:query(ref,where('email','==',user.email));onSnapshot(q,s=>{const p=s.docs.map(d=>({id:d.id,...d.data()}));for(const [id,estado] of [['statTotal',null],['statPendentes','Pendente'],['statAprovados','Aprovado'],['statEntregues','Entregue'],['statDevolvidos','Devolvido']])if(el(id))el(id).textContent=estado?p.filter(x=>x.estado===estado).length:p.length;const tb=el('recentActivityTable');if(tb){tb.replaceChildren();p.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,5).forEach(x=>tb.append(celulas(document.createElement('tr'),[x.idPedido||x.id,x.aluno,x.equipamento,x.dataPedido,x.estado])))}},e=>console.error('Dashboard:',e))});


// ===== pedidos.js =====
onAuthStateChanged(auth,user=>{if(!user)return;if(el('nomeAluno'))el('nomeAluno').value=user.displayName||'Aluno EPBJC';if(el('emailAluno'))el('emailAluno').value=user.email;const form=el('formRequisicao');if(form)form.addEventListener('submit',async e=>{e.preventDefault();const inicio=el('dataLevantamento').value,fim=el('dataDevolucao').value,qtd=Number(el('quantidade').value);const hoje=new Date();const hojeLocal=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;if(inicio<hojeLocal||fim<inicio||!Number.isInteger(qtd)||qtd<1||qtd>3){alert('Confirma as datas e a quantidade (1 a 3).');return}const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;try{await addDoc(collection(db,'requisicoes'),{idPedido:'EPBJC-'+Date.now(),aluno:user.displayName||'Aluno EPBJC',email:user.email,turma:el('turmaAluno').value,equipamento:el('equipamento').value,quantidade:qtd,dataPedido:hojeLocal,dataLevantamento:inicio,dataDevolucao:fim,finalidade:el('finalidade').value,observacoes:el('observacoes').value,estado:'Pendente',createdAt:serverTimestamp()});location.href='pedidos.html'}catch(e){erro(e)}finally{if(btn)btn.disabled=false}});const tb=el('tabelaPedidos');if(tb){const ref=collection(db,'requisicoes');onSnapshot(admin(user)?ref:query(ref,where('email','==',user.email)),s=>{tb.replaceChildren();s.forEach(d=>{const p=d.data();tb.append(celulas(document.createElement('tr'),[p.idPedido||d.id,p.aluno,p.equipamento,p.quantidade,p.dataDevolucao,p.estado]))})},erro)}});


// ===== inventario.js =====
import {collection,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';const tb=el('tabelaInventario');if(tb)onSnapshot(collection(db,'inventario'),s=>{tb.replaceChildren();s.forEach(d=>{const p=d.data();tb.append(celulas(document.createElement('tr'),[d.id,p.nome,p.categoria,p.quantidadeTotal,p.quantidadeDisponivel,Number(p.quantidadeDisponivel)>0?'Disponível':'Indisponível']))})},erro);


// ===== entregas.js =====
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';import {collection,onSnapshot,doc,runTransaction} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
onAuthStateChanged(auth,user=>{if(!admin(user))return;const tb=el('tabelaEntregas');if(!tb)return;onSnapshot(collection(db,'requisicoes'),s=>{tb.replaceChildren();s.forEach(d=>{const p=d.data();if(!["Pendente","Aprovado"].includes(p.estado))return;const tr=celulas(document.createElement('tr'),[p.idPedido||d.id,p.aluno,p.equipamento,p.quantidade,p.estado]);const td=document.createElement('td'),b=document.createElement('button');b.className='btn';b.textContent='Marcar entregue';b.onclick=async()=>{if(!confirm('Confirmar alteração?'))return;b.disabled=true;try{await runTransaction(db,async t=>{const r=doc(db,'requisicoes',d.id),snap=await t.get(r);if(!snap.exists()||!["Pendente","Aprovado"].includes(snap.data().estado))throw new Error('Estado do pedido alterado.');t.update(r,{estado:'Entregue'})});alert('Registado com sucesso.')}catch(e){erro(e)}finally{b.disabled=false}};td.append(b);tr.append(td);tb.append(tr)})},erro)});


// ===== devolucoes.js =====
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';import {collection,onSnapshot,doc,runTransaction} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
onAuthStateChanged(auth,user=>{if(!admin(user))return;const tb=el('tabelaDevolucoes');if(!tb)return;onSnapshot(collection(db,'requisicoes'),s=>{tb.replaceChildren();s.forEach(d=>{const p=d.data();if(!["Entregue"].includes(p.estado))return;const tr=celulas(document.createElement('tr'),[p.idPedido||d.id,p.aluno,p.equipamento,p.quantidade,p.estado]);const td=document.createElement('td'),b=document.createElement('button');b.className='btn';b.textContent='Registar devolução';b.onclick=async()=>{if(!confirm('Confirmar alteração?'))return;b.disabled=true;try{await runTransaction(db,async t=>{const r=doc(db,'requisicoes',d.id),snap=await t.get(r);if(!snap.exists()||!["Entregue"].includes(snap.data().estado))throw new Error('Estado do pedido alterado.');t.update(r,{estado:'Devolvido'})});alert('Registado com sucesso.')}catch(e){erro(e)}finally{b.disabled=false}};td.append(b);tr.append(td);tb.append(tr)})},erro)});


é isso que tenho no app/js
