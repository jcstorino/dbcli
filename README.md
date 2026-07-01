# dbcli

CLI para acesso a SQL Server com foco em uso por agentes de IA.

## Objetivo

Use esta ferramenta para:

- testar conexão
- executar consultas SQL
- inspecionar tabelas e colunas
- exportar resultados
- consultar metadados básicos do Protheus

Não use esta ferramenta para assumir regras de negócio do projeto.
Ela é operacional.

## Pré-requisitos

- Node.js
- dependências instaladas com `npm install`
- build gerado com `npm run build`
- arquivo `connections.local.yaml` configurado no diretório do projeto

## Arquivo de conexão

O arquivo esperado é:

```text
connections.local.yaml
```

Estrutura:

```yaml
connections:
  - name: protheus
    provider: sqlserver
    server: localhost
    port: 1433
    database: PROTHEUS
    username: -usuario-
    password: -senha-
    encrypt: false
    trustServerCertificate: true
```

Use sempre o `name` da conexão nos comandos.
Use `connections.local.example.yaml` como referência.
Não versione `connections.local.yaml`.

## Fluxo recomendado para agentes

Ao precisar trabalhar com banco:

1. validar a conexão com `db test`
2. descobrir tabelas com `db tables` se necessário
3. inspecionar colunas com `db describe`
4. executar consultas com `db query`
5. quando for Protheus, usar `db protheus` para ler SX2/SX3

## Segurança

O comando `query` opera em modo safe por padrão.

Por padrão ele bloqueia:

- `insert`
- `update`
- `delete`
- `merge`
- `truncate`
- `create`
- `alter`
- `drop`
- `rename`

Para liberar escrita, use:

```bash
db query <connection> "<sql>" --allow-write
```

Use `--allow-write` somente com instrução explícita.

## Comandos

### Testar conexão

```bash
db test <connection>
```

Exemplo:

```bash
db test protheus
```

Retorno esperado:

- `ok`

### Executar query inline

```bash
db query <connection> "<sql>"
```

Exemplo:

```bash
db query protheus "select top 10 * from sa1990"
```

### Executar query por arquivo

```bash
db query <connection> --file <arquivo.sql>
```

Exemplo:

```bash
db query protheus --file ./scripts/clientes.sql
```

### Listar tabelas

```bash
db tables <connection>
db tables <connection> --schema <schema>
```

Exemplo:

```bash
db tables protheus --schema dbo
```

### Descrever tabela física

```bash
db describe <connection> <tabela>
```

Exemplos:

```bash
db describe protheus SA1990
db describe protheus dbo.SA1990
```

### Ler metadados Protheus

Consulta SX2 e SX3.

```bash
db protheus <connection> <alias>
```

Exemplo:

```bash
db protheus protheus SA1
```

Retorna:

- alias da tabela
- descrição da tabela
- campo
- título
- descrição
- tipo
- tamanho
- decimais
- ordem

## Formatos de saída

Todos os comandos de leitura aceitam:

```bash
--format table
--format json
--format csv
```

Padrão:

```text
table
```

Exemplo:

```bash
db query protheus "select top 5 name from sys.tables" --format json
```

## Exportar resultado

Para gravar em arquivo:

```bash
--out <arquivo>
```

Exemplo:

```bash
db query protheus "select top 5 * from sa1990" --format json --out ./tmp/clientes.json
```

## Limitar linhas exibidas

Para limitar a saída:

```bash
--max-rows <n>
```

Exemplo:

```bash
db tables protheus --max-rows 20
```

Observação:

- o limite afeta a saída
- não altera a SQL executada

Se quiser limitar o banco, faça isso na própria query.

## Boas práticas para agentes

- sempre testar conexão antes do primeiro uso
- preferir `select`
- não usar `--allow-write` sem autorização explícita
- antes de consultar tabela Protheus, identificar o alias correto
- para Protheus, diferenciar:
  - alias lógico: `SA1`
  - tabela física no banco: `SA1990`, `SA1010` ou outra variação do ambiente
- usar `db protheus` para entender os campos antes de montar SQL
- usar `db describe` para validar a estrutura física real
- usar `--format json` quando a saída for consumida por outro processo

## Fluxo recomendado para Protheus

Quando o objetivo envolver fontes, campos, queries ou revisão técnica:

1. identificar o alias lógico do Protheus
2. executar `db protheus <conexao> <alias>`
3. validar a tabela física com `db tables` ou `db describe`
4. só então montar a query final

Exemplo:

```bash
db protheus protheus SA1
db describe protheus SA1990
db query protheus "select top 20 a1_cod, a1_loja, a1_nome from sa1990"
```

## Limitações atuais

- provider ativo: SQL Server
- Oracle ainda não implementado
- MCP ainda não implementado
- metadados Protheus atualmente focam em SX2 e SX3

## Comandos de desenvolvimento

```bash
npm run build
npm run lint
npm run test
```
