# Plano de Resiliência da Transmissão de Tela

## Estado implementado

O Discódia publica compartilhamento de tela como uma trilha de vídeo, usando a captura nativa que o navegador apresenta ao participante. A escolha de tela, janela ou guia continua sob controle do seletor do navegador; para áudio de guia, o participante deve escolher uma guia compatível e habilitar explicitamente o compartilhamento de áudio.[^screen]

Os perfis de 540p, 720p e 1080p agora incluem três camadas simulcast: uma econômica, uma intermediária e uma camada superior correspondente à resolução de captura. Dessa forma, quem abre a transmissão no palco pode solicitar a camada nativa, enquanto miniaturas e espectadores em rede degradada recebem uma camada mais leve. O cliente mantém `dynacast` e `adaptiveStream`, que complementam esse comportamento reduzindo as camadas não necessárias e adequando a recepção ao tamanho e à visibilidade do vídeo.[^adaptive]

## Diagnóstico em sessão real

Antes e depois de qualquer alteração, registrar uma amostra de pelo menos sessenta segundos para cada cenário: guia com vídeo, streaming ao vivo e jogo. A amostra precisa incluir bitrate, RTT, jitter, perda de pacotes, FPS, quadros descartados, motivo de limitação de qualidade e rota ICE. Esses dados permitem distinguir limitação por CPU, rede local, rota de retransmissão ou conteúdo protegido.

| Sinal observado | Critério de atenção | Ação recomendada |
|---|---:|---|
| Perda de pacotes | A partir de 1% | Reduzir perfil, avaliar Wi-Fi e rota ICE. |
| RTT | A partir de 120 ms | Preferir perfil de 30 fps e investigar região/rota do SFU. |
| Jitter | A partir de 15 ms | Estabilizar a rede antes de elevar resolução ou FPS. |
| Limitação por CPU | Indicada pelo navegador | Usar 720p/30 e fechar processos que usam aceleração de vídeo. |
| Queda de FPS | Persistente durante a amostra | Priorizar 30 fps, confirmar uso da camada correta e testar outro codec/dispositivo. |

## Limites e próximos passos

O ajuste de simulcast melhora a disponibilidade de resolução, mas não substitui validação com chamadas reais. Conteúdo protegido por DRM pode aparecer preto ou não ser capturável por decisão do navegador ou do serviço de origem; esse comportamento não deve ser contornado. Depois da medição publicada, a mitigação adicional deve ser definida a partir da causa observada, sem alterar a configuração de voz que já está estável.

[^screen]: [LiveKit — Screen sharing](https://docs.livekit.io/transport/media/screenshare/)
[^adaptive]: [LiveKit — Adaptive stream settings](https://docs.livekit.io/reference/client-sdk-js/types/AdaptiveStreamSettings.html)
