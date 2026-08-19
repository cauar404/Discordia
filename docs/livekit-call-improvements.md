# Referências técnicas para aprimorar chamadas

## Áudio individual

O LiveKit recomenda substituir `RoomAudioRenderer` por uma composição de `useTracks` e `AudioTrack` quando a interface precisa controlar volume e silenciamento por trilha. Para o Círculo, isso permite manter volumes separados por participante e por áudio de compartilhamento, exclusivamente no dispositivo de quem escuta.

Fonte: https://docs.livekit.io/reference/components/react/concepts/rendering-audio/

## Áudio de transmissão

Em navegadores compatíveis, o áudio só é capturado ao selecionar uma aba do navegador e marcar a opção de compartilhamento de áudio no seletor nativo. Janelas e telas inteiras podem não fornecer uma trilha de áudio.

Fonte: https://docs.livekit.io/transport/media/screenshare/

## Limpeza de microfone e fluidez

Para chamadas entre navegadores, o LiveKit orienta o uso dos controles WebRTC `echoCancellation` e `noiseSuppression` na captura de áudio. Processamento avançado de voz do LiveKit Cloud é direcionado a agentes e pode ter custo adicional; portanto, não é base adequada para a implantação gratuita atual.

O áudio e o vídeo usam fluxos RTP separados. A adaptação de vídeo, simulcast e dynacast ajudam a reduzir a pressão do vídeo quando há concorrência por banda, mas não eliminam limites físicos de CPU, navegador, distância geográfica e rede.

Fontes: https://docs.livekit.io/transport/media/noise-cancellation/ e https://livekit.com/blog/audio-quality

## Adaptação e limites de fluidez

O LiveKit descreve `adaptiveStream`, simulcast e dynacast como mecanismos que ajustam bitrate, resolução e taxa de quadros conforme visibilidade do vídeo, condições de rede e perfil do dispositivo. Por isso, o Círculo os habilita para reduzir travamentos percebidos, mas apresenta 60 fps como preferência e não como garantia em qualquer conexão.

Fonte: https://livekit.com/use-cases/video-conferencing

O áudio de uma transmissão de tela continua dependente da escolha feita no seletor nativo do navegador: para capturar a faixa de áudio, a pessoa deve escolher uma **aba** e habilitar o compartilhamento de áudio. Cada pessoa que recebe a faixa controla apenas a reprodução no próprio dispositivo.

Fonte: https://docs.livekit.io/transport/media/screenshare/

## Latência percebida no produto

O cliente agora compartilha uma única configuração Socket.IO para mensagens, presença e chamadas: WebSocket direto, tentativa de conexão de 10 segundos e reconexão inicial de 500 ms com teto de 3 segundos. A estratégia evita a negociação inicial por long-polling e reduz o tempo de recuperação após pequenas quedas, mas não altera a distância entre o usuário, o Render e a região do LiveKit.

O módulo LiveKit também é carregado somente quando uma chamada é aberta. Isso reduziu o pacote inicial do aplicativo de aproximadamente 1,58 MB para 0,95 MB (minificado), transferindo cerca de 0,63 MB para o carregamento sob demanda da chamada. Essa divisão reduz o tempo de entrada e a competição por recursos antes de o usuário entrar em uma sala.
