# Alternativas de WebRTC para usuários no Brasil

**Data da pesquisa:** 19 de agosto de 2026  
**Escopo:** identificar alternativas ao LiveKit que possam reduzir a distância de mídia para um grupo brasileiro, sem iniciar migração.

## Constatações iniciais

| Serviço | Gratuidade verificada | Região Brasil garantida? | Observação inicial |
|---|---:|---|---|
| Daily Video | 10.000 participant-minutes/mês | Não confirmada nesta etapa | Oferece *Regional Media Zones* sem custo adicional, mas a região selecionável precisa ser confirmada com o fornecedor antes de qualquer migração. |
| Cloudflare Realtime SFU + TURN | 1.000 GB/mês compartilhados entre SFU e TURN | Não declarada como fixação Brasil | É uma alternativa promissora pelo edge global e pela franquia, mas está em beta e requer reimplementação relevante de cliente, tokens e controle de sala. |
| Jitsi self-hosted ou LiveKit self-hosted em São Paulo | O software é aberto; a infraestrutura depende da nuvem escolhida | Sim, se a VM for criada em São Paulo | É a única rota tecnicamente controlável para hospedar o SFU no Brasil sem depender do produto gerenciado de terceiros, mas exige operação de TURN, monitoramento e uma VM que não é garantidamente gratuita. |

A Oracle documenta as regiões `sa-saopaulo-1` (São Paulo) e `sa-vinhedo-1` (Vinhedo), portanto uma implantação própria pode, de fato, ser posicionada no Brasil. Isso não transforma a infraestrutura em custo zero garantido: a criação depende de capacidade da região e um SFU de vídeo ainda precisa de IP público, TLS, regras de firewall/UDP, observabilidade e TURN para redes restritivas.

O Jitsi confirma o modelo de auto-hospedagem, mas também alerta que a configuração WebRTC pública exige HTTPS e um servidor de Internet com domínio e certificado. Assim, ele não é uma troca direta para o Círculo: substituir LiveKit por Jitsi requer reescrever a integração de salas, controles individuais de mídia, tela compartilhada e telemetria.

## Escala do grupo e compatibilidade

Para o grupo planejado de até 15 pessoas, os 10.000 participant-minutes/mês do Daily equivalem a aproximadamente **11,11 horas** de chamada com 15 participantes simultâneos, ou **5,55 horas** de sessões com 15 pessoas e duração de duas horas. Quatro reuniões mensais de duas horas com o grupo completo consomem 7.200 participant-minutes, portanto permanecem dentro da franquia. O cálculo não é uma medição de desempenho e não substitui a confirmação da região atendida.

| Caminho | Impacto na aplicação atual | Potencial de reduzir distância até a mídia | Risco operacional |
|---|---|---|---|
| Manter LiveKit Cloud no plano Build | Nenhuma reescrita; o Círculo já está integrado e com diagnóstico de rota. | Depende do roteamento global e da rede real; não fixa Brasil. | Baixo. |
| Migrar para Daily | Reescrita substancial do cliente de chamadas, tokens e gerenciamento de tracks. | Indeterminado até o Daily confirmar uma zona de mídia Brasil/Sul da América para a conta. | Médio. |
| Migrar para Cloudflare Realtime | Reescrita integral do fluxo de SFU/TURN, autenticação e observabilidade; produto em beta. | Edge global pode ser vantajoso, mas não substitui uma garantia de SFU no Brasil. | Alto. |
| Auto-hospedar LiveKit em São Paulo | Alterar endpoint, operação de infraestrutura e credenciais; preservar boa parte da lógica LiveKit existente. | Alto, porque o SFU pode ficar fisicamente em São Paulo. | Alto: disponibilidade de VM, TURN, firewall UDP, atualizações e monitoramento passam a ser responsabilidade do projeto. |
| Auto-hospedar Jitsi em São Paulo | Reescrita substancial de todas as funções de chamada integradas ao Círculo. | Alto, porque o JVB pode ficar fisicamente em São Paulo. | Alto. |

## Fontes iniciais

[1] [Daily Video Pricing](https://www.daily.co/pricing/video-sdk/) — informa 10.000 minutos gratuitos mensais e *Regional Media Zones* como adicional sem cobrança.

[2] [Cloudflare Realtime SFU Pricing](https://developers.cloudflare.com/realtime/sfu/pricing/) — informa franquia compartilhada de 1.000 GB/mês para SFU e TURN e preço posterior de US$ 0,05/GB.

[3] [Oracle Cloud — Regions and Availability Domains](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm) — lista regiões brasileiras, incluindo São Paulo e Vinhedo.

[4] [Jitsi Meet — Self-hosting Guide](https://jitsi.github.io/handbook/docs/devops-guide/) — documentação oficial de hospedagem própria do Jitsi.
