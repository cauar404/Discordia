# Linha de Base de Desempenho Publicado

> Medição realizada em 21 de agosto de 2026 a partir de uma conexão externa ao serviço Render. Os valores indicam o tempo de resposta observado no ponto de teste e não substituem a medição dentro da rede de cada participante.

| Recurso | Estado | Tempo total inicial | TTFB inicial | Tamanho |
|---|---:|---:|---:|---:|
| `/` | 200 | 3,80 s | 2,92 s | 368,6 KB |
| `/api/health` | 200 | 3,41 s | 3,41 s | 38 B |
| JavaScript principal | 200 | 4,36 s | — | 218,5 KB |
| CSS principal | 200 | 2,30 s | — | 177,9 KB |

Cinco leituras consecutivas de `/api/health` ficaram entre **1,73 s e 2,67 s**, com TTFB entre **1,73 s e 2,45 s**. Isso mostra que a latência não foi apenas um cold start pontual.

## Achado prioritário

Os ativos versionados estavam sendo entregues com `Cache-Control: public, max-age=0`, fazendo o navegador revalidar JavaScript e CSS a cada acesso. A aplicação agora envia `Cache-Control` imutável por um ano para `/assets`, cujos nomes incluem hash de conteúdo, e preserva `index.html` sem cache prolongado para que novas versões sejam encontradas normalmente.

Além disso, o build de produção deixou de incluir os plugins de runtime, localização JSX e coletor de depuração usados apenas na prévia. A validação local reduziu o `index.html` compilado de **368,6 KB** para **1.415 B** e confirmou que o documento não referencia `debug-collector.js` nem o runtime de prévia. A cópia estática do coletor pode permanecer no artefato por necessidade do ambiente de desenvolvimento, mas não é carregada pelo navegador em produção.

## Próximas medições

Após a publicação, repetir as leituras e conferir os cabeçalhos de `/assets`. O primeiro acesso ainda depende da resposta do Render; os acessos seguintes devem reutilizar JavaScript e CSS do cache do navegador. A latência de TTFB do servidor e a demora de consultas autenticadas serão tratadas separadamente.
