# Notas de incidente de produção

## Carregamento infinito após login — 2026-08-19

A página inicial publicada em `https://discordia-1-8oe2.onrender.com` carregou normalmente e apresentou o formulário de login. Antes da autenticação, não havia erros no console do navegador. O relato do usuário delimita a falha ao estado posterior ao login; portanto, a próxima investigação deve concentrar-se nas requisições autenticadas de bootstrap, sessão, comunidades e preferências, bem como no estado de autenticação persistido no cliente.

## Verificação visual local — 2026-08-19

A tela inicial foi verificada depois da separação sob demanda do módulo de chamadas. Em 1280×720, o cartão de autenticação permaneceu centralizado, legível e sem estouro horizontal. Em 375×812, os campos, as abas de entrada/criação de conta e a ação principal permaneceram acessíveis, com o texto complementar dentro do cartão.

Esta evidência cobre somente a tela inicial. A aparência da sala de chamada com mídia ativa continua dependente de validação real por participantes conectados.
