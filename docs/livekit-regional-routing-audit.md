# Auditoria de rota regional LiveKit

## Escopo

Esta auditoria limita-se à rota de sinalização e mídia do LiveKit. Nenhuma alteração de interface, recurso de chamada ou substituição de tecnologia faz parte deste trabalho.

## Constatações oficiais iniciais

| Tema | Constatação verificável | Impacto para o Círculo |
|---|---|---|
| Roteamento padrão | O endpoint global do LiveKit Cloud tenta encaminhar o cliente ao edge mais próximo. | O endereço global já é a opção segura enquanto não há evidência de que a rota brasileira esteja errada. |
| Brasil | O grupo de region pinning `sa` corresponde à América do Sul, com localização no Brasil. | É a região a solicitar ao suporte do LiveKit Cloud caso a medição real mostre encaminhamento fora do Brasil. |
| Region pinning | É uma configuração habilitada pelo LiveKit para projetos Scale ou superiores e remove o failover automático para a região mais próxima em uma indisponibilidade. | Não será ativado ou simulado no código sem confirmação de plano, suporte e medição comparativa. |
| Transporte | A ordem padrão é ICE/UDP, TURN/UDP, ICE/TCP e TURN/TLS. | Não será forçado TURN nem TCP; a auditoria deve registrar o candidate pair real e orientar a liberação de UDP quando a rede do participante o bloquear. |

## Dados reais do projeto LiveKit Cloud

Em **19 de agosto de 2026**, o painel autenticado do projeto `Discórdia` apresentou os seguintes agregados para os sete dias anteriores:

| Indicador | Valor observado | Leitura para a rota |
|---|---:|---|
| Sucesso de conexão | 100% | Não há falha agregada de ingresso na infraestrutura LiveKit. |
| Tipo de conexão UDP | 97,6% | A grande maioria das sessões já utiliza o transporte prioritário de baixa latência. |
| Tipo de conexão TURN | 2,4% | Há uma parcela pequena de sessões com relay, que deve continuar como fallback. |
| País principal | Brasil, 41 participantes | O uso real é predominantemente brasileiro, reforçando a importância da rota regional. |
| País secundário | Estados Unidos, 1 participante | A presença fora do Brasil é residual no período observado. |
| Plano | Build | A documentação oficial reserva o region pinning para Scale ou superior. |

O projeto utiliza o endpoint global `discordia-r4nvjpnx.livekit.cloud`. A documentação do LiveKit indica que esse endpoint encaminha cada cliente ao edge mais próximo. O painel do projeto não apresentou, nas configurações gerais disponíveis, um seletor de região para ativação local. Assim, fixar a região `sa` (Brasil) depende de habilitação pelo suporte do LiveKit e de plano compatível; não é seguro trocar o URL da aplicação para um host regional não documentado.

As configurações de mídia mantêm os codecs Opus, RED, H.264, VP8, VP9 e AV1 habilitados. A opção **"Allow pausing videos when subscribers are congested"** estava desativada e foi ativada e salva com sucesso no projeto em **19 de agosto de 2026**. Essa política permite que o SFU alivie um assinante congestionado em vez de sustentar continuamente uma fila de vídeo atrasado. Ela preserva a prioridade definida para este projeto — **latência antes de qualidade** — sem modificar a interface nem os recursos da aplicação.

O cliente já coleta métricas WebRTC provenientes de `getRTCStatsReport()` a cada 2,5 segundos para uma transmissão ativa. O coletor usa o `candidate-pair` bem-sucedido e nominado como fallback para RTT, além de RTP de vídeo para jitter, perda, bitrate, FPS, frames descartados e motivo de limitação de qualidade. A etapa de validação deverá registrar o protocolo e o tipo do candidate pair selecionado durante uma chamada real, sem expor endereços IP na interface.

## Referências oficiais

1. https://docs.livekit.io/deploy/admin/regions/
2. https://docs.livekit.io/deploy/admin/regions/region-pinning/
3. https://docs.livekit.io/deploy/admin/regions/endpoints/
4. https://docs.livekit.io/deploy/admin/firewall/
5. https://docs.livekit.io/intro/basics/connect/

## Próximas verificações

O projeto precisa confirmar por métricas reais, durante uma chamada publicada com participantes no Brasil, a região atendida, o tipo e protocolo do candidate pair selecionado, RTT, jitter, perda e bitrate. Esses dados permitem separar problemas de rota/relay de limitações de codificação ou rede local. Nenhum valor será estimado ou registrado como medição sem uma sessão real.

## Procedimento de validação em chamada real

Use duas pessoas em cidades brasileiras distintas e uma transmissão de tela com movimento por pelo menos três minutos. O responsável técnico pode abrir o console do navegador do participante que compartilha a tela e filtrar por `Círculo LiveKit`. A aplicação passa a registrar somente a classificação da rota WebRTC quando ela muda: protocolo, tipo dos candidatos local/remoto, protocolo de relay e se a sessão utiliza relay. Nenhum endereço IP é registrado ou exibido.

| Resultado observado | Interpretação | Próxima decisão |
|---|---|---|
| `udp` sem relay, RTT baixo, perda abaixo de 1% e jitter abaixo de 15 ms | A rota direta está saudável. | Não alterar endpoint nem forçar TURN; investigar codificação apenas se houver travamentos visuais. |
| `udp` com relay, RTT consistente e perda baixa | Há fallback TURN, mas não necessariamente há problema de qualidade. | Manter o fallback; comparar com uma nova chamada em outra rede antes de atribuir atraso ao relay. |
| `tcp` ou relay TLS frequente | A rede está bloqueando o caminho UDP preferencial. | Liberar UDP de saída e as portas indicadas pela documentação do LiveKit na rede afetada. |
| Perda acima de 3%, jitter acima de 35 ms ou RTT acima de 250 ms | A telemetria classifica a rota como degradada. | Priorizar a investigação de rede e região; 60 fps não deve ser usado até a estabilização. |

## Região Brasil e region pinning

O endpoint global atual deve ser preservado. Ele foi projetado para rotear participantes ao edge mais próximo; trocar a aplicação para um host regional não documentado pode interromper o acesso. Para fixar o projeto no grupo `sa` (Brasil), a documentação do LiveKit requer **Scale ou superior** e abertura de solicitação ao suporte. Como o projeto está no plano Build, esta mudança não foi solicitada nem simulada.

Quando houver disponibilidade de plano compatível, o texto preparado para o suporte é: 

> Projeto `Discórdia` (ID `p_25wjn65lx0n`): solicitamos region pinning para o grupo `sa` (Brasil). A base de participantes é predominantemente brasileira; no painel dos últimos sete dias, 41 participantes foram do Brasil, 97,6% das conexões usaram UDP e o objetivo é reduzir a latência ponta a ponta de mídia. Estamos cientes de que a fixação reduz o failover automático entre regiões e aceitaremos esse trade-off para este ambiente privado.

## Referências

[1] [LiveKit — Regions and endpoints](https://docs.livekit.io/deploy/admin/regions/)

[2] [LiveKit — Region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning/)

[3] [LiveKit — Firewall and network configuration](https://docs.livekit.io/deploy/admin/firewall/)

[4] [LiveKit — Connecting to rooms](https://docs.livekit.io/intro/basics/connect/)
