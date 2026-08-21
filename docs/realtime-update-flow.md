# Fluxos de Atualização em Tempo Real

## Objetivo

O cliente mantém a interface atualizada por eventos Socket.IO sem transformar cada evento em uma recarga completa de consultas. O princípio é invalidar somente o conjunto de dados que foi alterado, preservando respostas rápidas para mensagens e ações de chamada.

## Salas e eventos

| Origem | Escopo de entrega | Evento | Atualização no cliente |
|---|---|---|---|
| Canal criado ou alterado | Comunidade | `channel` com `resource: "channel"` | Lista de canais da comunidade. |
| Mensagem, edição, reação, remoção ou fixação | Canal | `channel` com `resource: "message"` e `channelId` | Mensagens do canal aberto, somente quando o identificador coincide. |
| Participação, perfil, cargo ou comunidade | Comunidade | `community` | Comunidades, canais e membros. |
| Estado de chamada | Comunidade ou conversa | `call` | Chamada ativa e presença de voz. |
| Mensagem direta | Conversa direta | `direct` com `id` | Mensagens e lista da conversa aberta. |
| Notificação ou amizade | Usuário | `notification` ou `friendship` | Lista de notificações. |

## Carregamento inicial

A tela principal consulta a comunidade, o canal, os membros e as mensagens do canal selecionado. O cliente de atualizações em tempo real é aberto depois que há uma sessão de interface, entra nas salas correspondentes e faz uma reconexão com atraso progressivo quando necessário. O diálogo de mensagens diretas mantém uma conexão independente apenas enquanto estiver aberto.

## Critério de manutenção

Ao adicionar uma nova mutação, publicar o menor escopo possível — comunidade, canal ou conversa — e incluir um `resource` quando o evento de canal afetar somente estrutura ou conteúdo. Antes de voltar a usar uma invalidação ampla, confirmar que a informação necessária não pode ser atualizada pelo evento já existente.

## Limites de validação

Os testes confirmam o contrato de eventos e as invalidações direcionadas. A medição de latência percebida precisa acontecer em uma sessão publicada com múltiplos participantes, observando o tempo entre envio, recebimento do evento e renderização, além de RTT e estabilidade do WebSocket.
