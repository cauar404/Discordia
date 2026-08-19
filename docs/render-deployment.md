# Publicação do Círculo no Render

O Círculo deve ser publicado como **Web Service**, pois mantém um servidor Express e conexões Socket.IO persistentes. O serviço precisa expor a porta indicada por `PORT`; a aplicação já usa essa variável automaticamente. O Render fornece essa porta a um Web Service e recomenda que o processo a utilize.[1]

## 1. Serviço da aplicação

No serviço vinculado ao repositório `cauar404/Discordia`, deixe **Root Directory** vazio. A raiz do repositório agora contém o arquivo `package.json`.

| Campo | Valor |
|---|---|
| Tipo | **Web Service** |
| Runtime | Node |
| Branch | `main` |
| Root Directory | vazio |
| Build Command | `pnpm install --frozen-lockfile && pnpm run build` |
| Start Command | `pnpm start` |
| Plano | um plano sem hibernação, para preservar Socket.IO e chamadas em tempo real |

O Render reconstrói e implanta automaticamente serviços conectados a uma branch quando há novos commits; também permite executar manualmente **Clear build cache & deploy**.[2]

## 2. Banco MySQL privado no Render

> A mensagem **“banco de dados indisponível”** ocorre quando `DATABASE_URL` não aponta para um banco MySQL acessível ou quando as tabelas ainda não foram criadas.

Crie uma segunda unidade no Render a partir do template oficial de MySQL como **Private Service**, com runtime Docker. No serviço MySQL, informe valores secretos para `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD`. Adicione um disco persistente com o ponto de montagem exato `/var/lib/mysql`; essa é a configuração indicada pelo guia oficial do Render.[3]

Depois que o banco estiver disponível, use no serviço Web a URL interna do banco. Se o serviço MySQL se chama `circulo-mysql`, o formato é:

```text
DATABASE_URL=mysql://SEU_USUARIO:SUA_SENHA@circulo-mysql:3306/SEU_BANCO
```

Use os mesmos valores de `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_DATABASE` definidos no serviço privado. A URL interna não deve ser publicada nem enviada em mensagens.

## 3. Variáveis de ambiente do serviço Web

Abra **Environment** no serviço Web e adicione as variáveis abaixo. O Render mantém variáveis no painel e permite salvar já disparando um novo deploy.[4]

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | URL interna MySQL explicada acima | Sim |
| `JWT_SECRET` | segredo aleatório longo, exclusivo e privado | Sim |
| `LIVEKIT_URL` | URL do seu servidor LiveKit | Sim, para chamadas |
| `LIVEKIT_API_KEY` | chave do LiveKit | Sim, para chamadas |
| `LIVEKIT_API_SECRET` | segredo do LiveKit | Sim, para chamadas |
| `NODE_ENV` | `production` | Recomendada |
| `VITE_APP_ID` | `circulo-render` | Opcional; a aplicação já assume `circulo-local` se estiver ausente |

Não adicione `PORT`: o Render a fornece ao serviço Web. Também não copie as chaves internas `BUILT_IN_FORGE_*` do ambiente Manus. Recursos de arquivos que dependem desse provedor — como anexos e uploads de avatar — exigirão uma integração de armazenamento externo antes de serem usados em produção fora do Manus.

## 4. Criar as tabelas do banco

Quando as variáveis acima estiverem salvas, abra o **Shell** do serviço Web no Render e execute uma única vez:

```bash
pnpm db:migrate
```

Esse comando aplica as migrações Drizzle, inclusive o campo de senha e o índice único de e-mail. Em seguida, use **Manual Deploy → Clear build cache & deploy** para iniciar a versão mais recente.

## 5. Primeiro uso

Abra a URL `onrender.com` gerada pelo serviço. A tela inicial apresentará as abas **Criar conta** e **Entrar**. Crie a primeira conta com nome, e-mail e senha. Depois de entrar, use o botão de comunidades para criar a sua própria comunidade privada ou entre em uma comunidade existente usando um convite.

## Referências

[1]: https://render.com/docs/web-services "Render — Web Services"
[2]: https://render.com/docs/deploys "Render — Deploys"
[3]: https://render.com/docs/deploy-mysql "Render — Deploy MySQL"
[4]: https://render.com/docs/configure-environment-variables "Render — Environment Variables and Secrets"
