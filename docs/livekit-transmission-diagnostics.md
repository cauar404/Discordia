# Diagnóstico de estabilidade de transmissão

## Premissas do cenário

Os participantes relatam computadores de boa capacidade e Wi-Fi de alta velocidade. Portanto, a análise deve medir **rota até a infraestrutura de mídia, RTT, jitter, perda de pacotes, bitrate efetivo, frames enviados/decodificados e limitação por CPU ou banda**, em vez de atribuir as quedas apenas à conexão contratada.

## Descobertas de referência

| Referência | Implicação para o Círculo |
|---|---|
| [LiveKit: codecs e mídia avançada](https://docs.livekit.io/transport/media/advanced/) | Simulcast permite encaminhar uma camada adequada a cada receptor; Dynacast evita publicar camadas não consumidas. VP9/AV1 usam SVC, com troca de camada mais eficiente, mas dependem de compatibilidade de navegador. |
| [LiveKit: introdução ao simulcast](https://livekit.com/blog/an-introduction-to-webrtc-simulcast) | Para tela, escalabilidade temporal é útil: preservar nitidez com menos frames costuma ser preferível a congelar ao tentar manter 60 fps. A API WebRTC expõe `qualityLimitationReason` para distinguir limitação por CPU e largura de banda. |
| [LiveKit: teste de qualidade de áudio](https://livekit.com/blog/audio-quality) | Em uma chamada, áudio e vídeo usam fluxos RTP separados; indicadores de perda, jitter, RTT e bitrate devem ser observados durante reprodução de tela para identificar a origem real de falhas. |
| [LiveKit: assinatura de tracks](https://docs.livekit.io/transport/media/subscribe/) | No SDK JavaScript, Adaptive Stream depende de `Track.attach()`. Os componentes de vídeo atuais precisam manter a montagem de track compatível; qualquer renderização alternativa deve ser evitada ou validada. |

## Decisões de implementação a validar

1. Manter **540p/30** como perfil estável, oferecer **720p/30** como padrão de qualidade e tratar **60 fps** como perfil de movimento, não como padrão de vídeo/streaming.
2. Criar um coletor local de `RTCPeerConnection.getStats()` para mostrar valores de RTT, jitter, perda, bitrate, frames descartados e `qualityLimitationReason` sem enviar telemetria privada ao servidor.
3. Produzir recomendações por limiar e evitar reiniciar a transmissão automaticamente; mudanças de perfil precisam ser explicitamente confirmadas pelo usuário.
4. Testar participantes em redes distintas e verificar a região/rota do LiveKit. Alta velocidade contratada não elimina jitter, perda nem rota longa até a SFU.
5. Informar que serviços com DRM podem exibir tela preta ou restringir áudio independentemente do Círculo; isso não é corrigível por bitrate, codec ou layout da aplicação.

## Validação após a publicação

Com uma transmissão ativa, abra **Configurações da chamada** e observe o cartão **Diagnóstico da transmissão** durante dois minutos antes de alterar o perfil. Em condições estáveis, RTT, jitter e perda devem permanecer baixos e o status deve ficar em **Transmissão estável**. O indicador não envia essas métricas ao servidor; ele apenas lê as estatísticas disponíveis no navegador do participante.

| Sinal observado | Leitura prática | Próxima ação |
|---|---|---|
| **Rota instável** | Perda de 3% ou mais, RTT a partir de 250 ms ou jitter a partir de 35 ms. | Trocar temporariamente para 720p/30, comparar outra rede e verificar a região da sala LiveKit. |
| **Atenção à estabilidade** | Perda, jitter, RTT ou frames descartados começaram a oscilar, ainda sem interrupção contínua. | Manter 720p/30 e observar se os números se estabilizam antes de usar 60 fps. |
| **Codificação limitada** | O navegador informou limitação de CPU para o codificador. | Reduzir para 720p/30 e fechar programas que usem aceleração de vídeo; computadores fortes ainda podem ter o encoder do navegador disputado. |
| **Transmissão estável** | Não há sinais relevantes de perda, jitter, RTT ou limitação do codificador. | Aumentar um passo por vez; reservar 60 fps para jogos e cenas com movimento contínuo. |

> Netflix e outros serviços com DRM podem bloquear ou degradar a captura por decisão do navegador e do serviço. A aplicação pode medir a conexão, mas não deve tentar contornar essa proteção.
