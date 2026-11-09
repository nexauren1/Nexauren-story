# Nexauren — configuração de administração e Firebase

## Dar acesso administrativo ao teu utilizador

O painel editorial fica em /nexauren-control/. Não aparece na navegação pública e não é indexado. O acesso real é controlado por uma custom claim do Firebase Authentication (admin: true), não por uma palavra-passe escondida no JavaScript.

1. Confirma o UID da conta Firebase que será o administrador no Firebase Console → Authentication → Users.
2. Cria/usa uma credencial de serviço Firebase Admin apenas num computador seguro. Nunca coloques o ficheiro JSON no repositório.
3. No terminal, define a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS para o caminho desse ficheiro.
4. Instala as dependências e executa:

   npm install

   npm run grant:admin -- O_UID_DO_UTILIZADOR

5. Termina a sessão no site e volta a entrar para receber o token atualizado.

O script só atribui a permissão ao UID indicado. Não altera a palavra-passe da conta.

## Publicar as regras de Firestore e Storage

No Firebase Console, confirma primeiro que Cloud Firestore e Firebase Storage estão ativos no projeto. Depois, com a Firebase CLI instalada e autenticada:

firebase login

firebase deploy --project nexauren-story-e8327 --only firestore:rules,storage

As regras permitem que qualquer visitante leia apenas artigos com estado published. Só uma conta com a custom claim admin: true pode criar, alterar ou apagar artigos. As imagens de capa são públicas para leitura e só administradores podem enviá-las, com limite de 8 MB e MIME type JPG/PNG/WebP.

## Campos do painel editorial

O painel permite título, slug, resumo, imagem de capa, conteúdo Markdown básico, etiquetas, título SEO, descrição SEO, rascunho e publicação. O blog recebe em tempo real os documentos publicados da coleção Firestore articles.

## Domínios de autenticação

No Firebase Authentication → Settings → Authorized domains, inclui nexaurenstory.com e www.nexaurenstory.com, além do domínio Firebase já listado.

## SEO automático

O comando npm run build executa o postbuild, que percorre o HTML gerado e cria dist/sitemap.xml e dist/robots.txt. Páginas que incluem noindex,nofollow são excluídas do sitemap.
