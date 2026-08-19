# Notas de Integração em Tempo Real

## Premissas confirmadas

Para uma integração de chamadas em produção, os tokens de acesso do LiveKit devem ser gerados no backend. Os tokens carregam a identidade do participante, a sala, permissões de entrada, publicação e assinatura, e são assinados com o segredo da API. A aplicação cliente recebe apenas o token de curta duração, nunca a chave ou o segredo do provedor.

O compartilhamento de tela é publicado como uma faixa de vídeo e pode solicitar ao navegador a seleção de uma tela, janela ou aba. A disponibilidade de áudio da aba depende do navegador e da seleção feita pela pessoa que compartilha.

## Fontes

1. [LiveKit — Authentication](https://docs.livekit.io/frontends/build/authentication/)
2. [LiveKit — Tokens and grants](https://docs.livekit.io/frontends/reference/tokens-grants/)
3. [LiveKit — Screen sharing](https://docs.livekit.io/transport/media/screenshare/)
