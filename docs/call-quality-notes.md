# Notas de qualidade de chamadas

O cliente de chamadas usa LiveKit. A documentação oficial informa que o SDK permite controlar a captura de vídeo por resolução e taxa de quadros e configurar parâmetros de publicação por bitrate e FPS. As resoluções predefinidas incluem `h720` (1280×720), mas a configuração pode ser definida explicitamente por faixa.

Para esta aplicação, as opções de interface serão tratadas como preferências de captura para compartilhamento de tela: **720p / 60 fps** e **1080p / 60 fps**. A qualidade efetivamente entregue pode ser reduzida pelo navegador, pela capacidade do dispositivo ou pelas condições de rede; a interface deve comunicar esse limite sem simular uma qualidade que não esteja sendo publicada.

A grade de participantes e a superfície dedicada de compartilhamento devem usar referências de faixa de câmera e de tela fornecidas pelos componentes React do LiveKit, que atualizam a representação conforme participantes entram, saem ou publicam novas faixas.

## Áudio de transmissão e qualidade observável

Em navegadores, uma transmissão com áudio depende de a pessoa escolher uma **aba do navegador** e marcar a opção de compartilhar o áudio da aba no seletor nativo. Janelas e telas inteiras podem não disponibilizar uma faixa de áudio; nesse caso, a chamada deve continuar normalmente, mas sem prometer som na transmissão. O receptor usa o renderizador de áudio da sala para reproduzir as faixas recebidas, incluindo a faixa `screen_share_audio` quando ela existir.[3]

O LiveKit separa áudio e vídeo em fluxos RTP distintos e usa Opus com RED habilitado por padrão, portanto uma imagem de tela pesada não deve, por si só, reduzir a qualidade do áudio. Na prática, perda de pacotes, limitações da captura do navegador, recursos do dispositivo e largura de banda disponível ainda podem afetar a experiência. Para uma transmissão contínua, a aplicação deve usar preferências de áudio próprias para conteúdo e manter a redundância de áudio habilitada.[1][4]

Captura e codificação são etapas diferentes. A preferência de 60 fps precisa ser aplicada tanto na captura quanto nos parâmetros de publicação; ainda assim, simulcast, adaptação de rede, limitação do navegador e capacidade de CPU podem reduzir a taxa efetivamente entregue. A interface deve mostrar a preferência selecionada como meta e explicitar que não se trata de garantia de 60 fps.[1]

## Referências

1. [LiveKit — Advanced media](https://docs.livekit.io/transport/media/advanced/)
2. [LiveKit React — useTracks](https://docs.livekit.io/reference/components/react/hook/usetracks/)
3. [LiveKit — Screen sharing](https://docs.livekit.io/transport/media/screenshare/)
4. [LiveKit — Measuring audio quality with video and screen share](https://livekit.com/blog/audio-quality)
