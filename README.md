# EBJC Equipamentos — versão corrigida

Portal estático para GitHub Pages com autenticação Microsoft via Firebase Authentication e dados no Cloud Firestore.

## Correções e funcionalidades incluídas
- Corrigida a exportação/importação de `firebaseConfig`.
- Firebase inicializado uma única vez e partilhado entre módulos.
- Login Microsoft com seleção de conta, popup e retorno por redirect.
- Validação do domínio `@alunos.epbjc.pt`.
- Proteção de páginas internas e terminar sessão.
- Criar requisições no Firestore e consultar pedidos.
- Painel com contadores, entregas e devoluções.
- Ações de gestão limitadas a emails configurados como administradores.
- Ficheiro `FIRESTORE_RULES.txt` com regras de partida.

## Passos obrigatórios antes de publicar

### 1. Firebase Authentication
No Firebase Console → Authentication → Sign-in method:
- Ativa o fornecedor Microsoft.
- Introduz o Application (client) ID e Client Secret da aplicação Microsoft Entra.
- Guarda.
- Em Authorized domains, adiciona `lourdes2006.github.io` (ou o domínio personalizado efetivamente usado).
- O URI de redirecionamento OAuth da aplicação Microsoft deve ser:
  `https://teste-epbjc-c022b.firebaseapp.com/__/auth/handler`

### 2. Microsoft Entra
No centro de administração Microsoft Entra:
- Regista uma aplicação que permita as contas da organização/tenant da escola.
- Configura plataforma Web com o URI acima.
- Copia o Client ID e cria um Client Secret para introduzir no Firebase.
- A conta/tenant tem de permitir o consentimento e autenticação necessários.

### 3. Administradores
Edita `js/firebase-config.js` e coloca os emails reais dos responsáveis dentro de `ADMIN_EMAILS`.
A lista está vazia por omissão. Sem configuração, os utilizadores autenticam-se e podem criar/consultar os próprios pedidos, mas não podem aprovar, entregar ou registar devoluções.

### 4. Firestore
Cria a base de dados Firestore.
Copia `FIRESTORE_RULES.txt` para Firestore → Rules e substitui o email de exemplo pelo email administrativo real.
Publica as regras. Ajusta a regra `signedIn()` caso a escola use um processo de verificação de email diferente.

### 5. GitHub Pages
Envia todos os ficheiros para a branch `main`. O workflow existente em `.github/workflows/static.yml` publica o conteúdo no GitHub Pages.
Abre `https://lourdes2006.github.io/Requisicao-de-Equipamentos/` (se esse for o endereço Pages configurado).

## Limitações conhecidas
- O inventário apresenta os tipos de equipamento e a quantidade atualmente requisitada; não existe no projeto original uma tabela de stock real com quantidades totais. Por isso, os totais e disponibilidade aparecem como “—” e não são inventados.
- O email do administrador não foi fornecido, pelo que a lista administrativa fica vazia até ser configurada.
- A validação de domínio no cliente melhora a experiência, mas a segurança efetiva depende das regras Firestore e da configuração do fornecedor Microsoft.
- Esta versão não foi autenticada contra o tenant real da escola; é necessário completar a configuração externa indicada acima.
