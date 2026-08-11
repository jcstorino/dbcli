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
  - name: ad-sample
    provider: sqlserver
    authentication: windows
    server: sqlserver.exemplo.local
    port: 1433
    database: master
    encrypt: true
    trustServerCertificate: true
```

Use sempre o `name` da conexão nos comandos.
Use `connections.local.example.yaml` como referência.
Não versione `connections.local.yaml`.

## Modos de autenticação

### SQL Server

Padrão:

```yaml
authentication: sql
username: -usuario-
password: -senha-
```

### Windows Authentication via Kerberos/Trusted Connection

Use este modo quando a máquina já possui ticket Kerberos válido e runtime .NET disponível.

```yaml
authentication: windows
```

Este modo usa `Microsoft.Data.SqlClient` via helper local em .NET.
Pré-requisitos comuns em macOS/Linux:

```bash
dotnet --version
klist
```

Se `klist` não mostrar ticket válido, obtenha um antes de usar a conexão.

### NTLM com credenciais de domínio

```yaml
authentication: ntlm
domain: EXEMPLO
username: usuario
password: senha
```

## Fluxo recomendado para agentes

Ao precisar trabalhar com banco:

1. validar a conexão com `dbcli test`
2. descobrir tabelas com `dbcli tables` se necessário
3. inspecionar colunas com `dbcli describe`
4. executar consultas com `dbcli query`
5. quando for Protheus, usar `dbcli protheus` para ler SX2/SX3
6. para diagnosticar ambiente, usar `dbcli doctor`

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
dbcli query <connection> "<sql>" --allow-write
```

Use `--allow-write` somente com instrução explícita.

## Comandos

### Testar conexão

```bash
dbcli test <connection>
```

Exemplo:

```bash
dbcli test protheus
```

Retorno esperado:

- `ok`

### Diagnóstico da conexão

```bash
dbcli doctor <connection>
```

Exemplo:

```bash
dbcli doctor oceanpact-producao
```

Checks típicos:

- arquivo de configuração em uso
- modo de autenticação
- DNS
- porta TCP
- ticket Kerberos
- runtime .NET
- teste real de login

### Executar query inline

```bash
dbcli query <connection> "<sql>"
```

Exemplo:

```bash
dbcli query protheus "select top 10 * from sa1990"
```

### Executar query por arquivo

```bash
dbcli query <connection> --file <arquivo.sql>
```

Exemplo:

```bash
dbcli query protheus --file ./scripts/clientes.sql
```

### Listar tabelas

```bash
dbcli tables <connection>
dbcli tables <connection> --schema <schema>
```

Exemplo:

```bash
dbcli tables protheus --schema dbo
```

### Descrever tabela física

```bash
dbcli describe <connection> <tabela>
```

Exemplos:

```bash
dbcli describe protheus SA1990
dbcli describe protheus dbo.SA1990
```

### Ler metadados Protheus

Consulta SX2 e SX3.

```bash
dbcli protheus <connection> <alias>
```

Exemplo:

```bash
dbcli protheus protheus SA1
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
dbcli query protheus "select top 5 name from sys.tables" --format json
```

## Exportar resultado

Para gravar em arquivo:

```bash
--out <arquivo>
```

Exemplo:

```bash
dbcli query protheus "select top 5 * from sa1990" --format json --out ./tmp/clientes.json
```

## Limitar linhas exibidas

Para limitar a saída:

```bash
--max-rows <n>
```

Exemplo:

```bash
dbcli tables protheus --max-rows 20
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
- usar `dbcli protheus` para entender os campos antes de montar SQL
- usar `dbcli describe` para validar a estrutura física real
- usar `--format json` quando a saída for consumida por outro processo

## Fluxo recomendado para Protheus

Quando o objetivo envolver fontes, campos, queries ou revisão técnica:

1. identificar o alias lógico do Protheus
2. executar `dbcli protheus <conexao> <alias>`
3. validar a tabela física com `dbcli tables` ou `dbcli describe`
4. só então montar a query final

Exemplo:

```bash
dbcli protheus protheus SA1
dbcli describe protheus SA1990
dbcli query protheus "select top 20 a1_cod, a1_loja, a1_nome from sa1990"
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
