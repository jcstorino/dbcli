#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$ROOT_DIR/skills/local/shared/dbcli-data-access"
REFERENCE_DIR="$SKILL_DIR/references"
REFERENCE_FILE="$REFERENCE_DIR/dbcli-readme.md"
SKILL_FILE="$SKILL_DIR/SKILL.md"

cd "$ROOT_DIR"

echo "npm install"
npm install

echo "npm run build"
npm run build

echo "npm link"
npm link

echo "gerando skill"
mkdir -p "$REFERENCE_DIR"

cat > "$SKILL_FILE" <<EOF
---
name: dbcli-data-access
description: "Acessar dados via DBCLI para testar conexao, listar tabelas, descrever colunas, executar consultas SQL em modo seguro, exportar resultados e consultar metadados Protheus. Use quando o usuario pedir acesso a banco, inspecao de tabelas, query SQL, leitura de SX2/SX3, validacao de estrutura fisica ou exportacao de resultado."
---

# DBCLI Data Access

Use este skill para acesso operacional a banco via DBCLI.
O executável obrigatório é \`dbcli\`; não use o comando genérico \`db\`.

## Escopo

- testar conexao
- listar tabelas
- descrever estrutura fisica
- executar consultas SQL
- exportar resultados
- consultar metadados Protheus via SX2 e SX3

## Nao use para

- assumir regra de negocio
- inferir semantica funcional sem evidencia
- liberar escrita sem autorizacao explicita

## Fluxo

1. Leia [references/dbcli-readme.md](references/dbcli-readme.md).
2. Confirme prerequisitos do projeto DBCLI.
3. Antes do primeiro uso, rode \`dbcli test <connection>\`.
4. Se precisar descobrir estrutura:
   - \`dbcli tables\`
   - \`dbcli describe\`
   - \`dbcli protheus\`
5. Para leitura de dados, prefira \`dbcli query\` em modo padrao seguro.
6. Use \`--format json\` quando a saida for alimentar outro processo.
7. Use \`--allow-write\` somente com instrucao explicita do usuario.

## Regras obrigatorias

- Use como referencia principal o README do DBCLI.
- O arquivo esperado de conexoes e \`connections.local.yaml\`.
- Nao versione \`connections.local.yaml\`.
- Sempre testar conexao antes do primeiro comando real.
- Para Protheus, diferencie alias logico de tabela fisica.
- Antes de montar SQL Protheus, prefira \`dbcli protheus\` e depois \`dbcli describe\`.
EOF

cat > "$REFERENCE_FILE" <<EOF
# Referencia DBCLI

## Caminho do projeto

- \`$ROOT_DIR\`

## Fonte principal

- \`README.md\` do projeto DBCLI

---

EOF

cat "$ROOT_DIR/README.md" >> "$REFERENCE_FILE"
printf '\n' >> "$REFERENCE_FILE"

echo "dbcli pronto"
