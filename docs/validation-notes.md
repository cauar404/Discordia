# Validação da versão inicial

## Verificações concluídas

- A rota principal respondeu na pré-visualização após reinicialização do servidor de desenvolvimento.
- O fluxo de conta autenticada, mas ainda pendente, foi verificado em desktop e mobile. Ele informa claramente a necessidade de aprovação e oferece resgate direto de convite.
- A compilação TypeScript foi executada com sucesso após as integrações de mensagens, tempo real, chamadas e limites de requisição.
- A suíte Vitest passou com sete verificações: logout, integração LiveKit configurada, políticas de acesso e timeout, e limitação de requisições.
- A interface de mensagens diretas foi revisada para confirmar conversas individuais e em grupo, anexos, respostas, edição, exclusão, reações, leitura, chamadas e indicação de digitação em sala privada.
- O painel administrativo foi revisado para confirmar a criação e atribuição de cargos, convites, moderação, auditoria e regras explícitas de permitir ou negar uma permissão por canal.
- A compilação de produção concluiu com sucesso. O pacote principal contém os recursos completos de comunicação, inclusive as bibliotecas de chamadas em tempo real; a ferramenta de compilação sinalizou apenas uma recomendação de divisão futura de pacotes, sem falha de build.
- O fluxo de arquivos utiliza o helper de armazenamento do projeto e referências `/manus-storage/`, servidas por redirecionamento assinado conforme a configuração da plataforma.

## Limite da verificação visual

O ambiente de pré-visualização estava autenticado com uma conta sem aprovação. Por isso, a navegação interna de uma comunidade, que exige convite ou aprovação reais, não pôde ser exercitada visualmente nesta sessão. O fluxo de resgate de convite foi disponibilizado na própria tela para viabilizar essa validação por uma conta aprovada.
