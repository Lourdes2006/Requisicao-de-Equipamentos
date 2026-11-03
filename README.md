# EPBJC — Estrutura simples

Mantém os HTML e CSS do projeto e utiliza apenas `js/firebase.js` e `js/app.js`.

1. Em `js/firebase.js`, substitui os valores de exemplo pelos dados da aplicação Web do Firebase.
2. Define o domínio autorizado e o email do administrador no mesmo ficheiro.
3. No Firebase Authentication, ativa **Email/Password** e cria os utilizadores autorizados.
4. Configura regras de segurança do Firestore para que alunos só consultem/criem os seus pedidos e administradores possam gerir os estados. A interface não substitui regras de segurança.
5. Abre `index.html` com Live Server. O index encaminha para login, e o login válido para o dashboard.

**Nota:** não está testado contra o teu Firebase real. A gestão de stock e a validação segura das operações administrativas precisam de ser concluídas antes de uso real. O ficheiro `app.js` junta a lógica dos ficheiros originais, sem bibliotecas adicionais.
