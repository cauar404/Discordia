# Notas de qualidade de mídia LiveKit

As configurações de publicação de tela podem definir `screenShareEncoding`, `screenShareSimulcastLayers`, `simulcast` e `degradationPreference`. A documentação explica que `maintain-framerate` reduz resolução para preservar fluidez, enquanto `maintain-resolution` pode reduzir quadros para preservar nitidez. A preferência será escolhida pelo perfil de tela compartilhada.

Para a recepção, `adaptiveStream` mede a visibilidade e o tamanho dos elementos de vídeo. A opção `pixelDensity: "screen"` usa a densidade real de pixels do monitor e pode elevar consumo de banda em monitores de alta definição. Ela será adotada para evitar subdimensionamento visual quando a transmissão estiver expandida, mantendo a adaptação e o dynacast ativos.

O SDK permite que a publicação remota solicite a maior qualidade aceita com `setVideoQuality`, mas o servidor pode reduzir a camada quando a largura de banda não for suficiente, priorizando continuidade em vez de congelamentos.

O navegador somente disponibiliza áudio de transmissão em contextos compatíveis; ao compartilhar uma aba, a pessoa deve habilitar o áudio da aba no seletor nativo. Plataformas com conteúdo protegido por DRM podem bloquear, degradar ou mostrar quadro preto independentemente das opções do aplicativo. Este projeto não tenta contornar tais proteções.

## Referências

1. [LiveKit — TrackPublishOptions](https://docs.livekit.io/reference/client-sdk-js/interfaces/TrackPublishOptions.html)
2. [LiveKit — AdaptiveStreamSettings](https://docs.livekit.io/reference/client-sdk-js/types/AdaptiveStreamSettings.html)
3. [LiveKit — Subscribing to tracks](https://docs.livekit.io/transport/media/subscribe/)
4. [LiveKit — Screen sharing](https://docs.livekit.io/transport/media/screenshare/)
