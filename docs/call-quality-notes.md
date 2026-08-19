# Notas de qualidade de chamadas

O cliente de chamadas usa LiveKit. A documentação oficial informa que o SDK permite controlar a captura de vídeo por resolução e taxa de quadros e configurar parâmetros de publicação por bitrate e FPS. As resoluções predefinidas incluem `h720` (1280×720), mas a configuração pode ser definida explicitamente por faixa.

Para esta aplicação, as opções de interface serão tratadas como preferências de captura para compartilhamento de tela: **720p / 60 fps** e **1080p / 60 fps**. A qualidade efetivamente entregue pode ser reduzida pelo navegador, pela capacidade do dispositivo ou pelas condições de rede; a interface deve comunicar esse limite sem simular uma qualidade que não esteja sendo publicada.

A grade de participantes e a superfície dedicada de compartilhamento devem usar referências de faixa de câmera e de tela fornecidas pelos componentes React do LiveKit, que atualizam a representação conforme participantes entram, saem ou publicam novas faixas.

## Referências

1. [LiveKit — Advanced media](https://docs.livekit.io/transport/media/advanced/)
2. [LiveKit React — useTracks](https://docs.livekit.io/reference/components/react/hook/usetracks/)
