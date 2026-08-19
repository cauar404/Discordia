# Banco gratuito para a publicação temporária

O Círculo usa o protocolo MySQL através de Drizzle e `mysql2`. Para evitar uma migração de banco, a opção gratuita recomendada é **TiDB Cloud Starter**, que é compatível com MySQL.[1]

## Condições confirmadas

| Item | Condição do TiDB Cloud Starter |
|---|---|
| Custo inicial | Gratuito dentro da franquia; não requer cartão para começar |
| Limite padrão | Até cinco instâncias gratuitas por organização |
| Armazenamento | 5 GiB de armazenamento por linhas e 5 GiB colunar por instância gratuita |
| Operações | 50 milhões de Request Units por mês |
| Conexão | Protocolo MySQL nativo por TCP, com TLS obrigatório |

A instância gratuita deve ter o limite de gastos mantido em `0`. Ao atingir a franquia, novas conexões podem ser bloqueadas até a renovação mensal ou alteração do limite.[1]

## Passos de conexão

Crie uma instância **Starter** em [TiDB Cloud](https://tidbcloud.com/), mantenha o limite de gastos em `0`, e use o diálogo **Connect** da instância para criar a senha. No diálogo, escolha `Public Endpoint`, branch `main`, banco `test` e `General`. Não use `sys`, pois ele é um esquema interno do banco. O seletor de sistema operacional pode permanecer como `Windows (Detected)`, pois ele altera apenas os exemplos de comando local e não a URL usada pelo Render.

O endpoint público exige TLS. A `DATABASE_URL` a ser salva somente no Render deve seguir este formato, substituindo os valores com os parâmetros exibidos pelo TiDB:

```text
mysql://USUARIO:SENHA@HOST:4000/test?ssl={"minVersion":"TLSv1.2"}
```

O driver `mysql2` aceita esse parâmetro e o TiDB documenta o uso de TLS para instâncias Serverless com endpoint público.[4]

## Referências

[1]: https://docs.pingcap.com/tidbcloud/select-cluster-tier/ "TiDB Cloud — Select a Plan"
[2]: https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/ "TiDB Cloud — Create a Starter or Essential Instance"
[3]: https://docs.pingcap.com/tidbcloud/connect-to-tidb-cluster-serverless/ "TiDB Cloud — Connect to Starter or Essential"
[4]: https://docs.pingcap.com/developer/dev-guide-sample-application-nodejs-mysql2/ "TiDB — Connect to TiDB with node-mysql2"
