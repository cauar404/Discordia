# Notas de incidente de produção

## Carregamento infinito após login — 2026-08-19

A página inicial publicada em `https://discordia-1-8oe2.onrender.com` carregou normalmente e apresentou o formulário de login. Antes da autenticação, não havia erros no console do navegador. O relato do usuário delimita a falha ao estado posterior ao login; portanto, a próxima investigação deve concentrar-se nas requisições autenticadas de bootstrap, sessão, comunidades e preferências, bem como no estado de autenticação persistido no cliente.
