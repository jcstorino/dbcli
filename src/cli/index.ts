import { Command } from 'commander';

import { TestCommand } from '../commands/TestCommand.js';
import { QueryCommand } from '../commands/QueryCommand.js';
import { TablesCommand } from '../commands/TablesCommand.js';
import { DescribeCommand } from '../commands/DescribeCommand.js';
import { ProtheusMetadataCommand } from '../commands/ProtheusMetadataCommand.js';
import { ErrorFormatter } from '../core/ErrorFormatter.js';
import { OutputFormat } from '../core/ResultRenderer.js';

const program = new Command();

const parsePositiveInteger = (value: string): number => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Valor inválido: '${value}'.`);
    }

    return parsed;
};

const parseFormat = (value: string): OutputFormat => {
    if (value === 'table' || value === 'json' || value === 'csv') {
        return value;
    }

    throw new Error(`Formato inválido: '${value}'.`);
};

program
    .name('dbcli')
    .description('Database CLI')
    .version('0.1.0');

program
    .command('test')
    .argument('<connection>', 'Connection name')
    .action(async (connection: string) => {
        await new TestCommand().execute(connection);
    });

program
    .command('query')
    .argument('<connection>', 'Connection name')
    .argument('[sql]', 'SQL query')
    .option('--allow-write', 'Allow DML/DDL execution')
    .option('-f, --file <path>', 'SQL file')
    .option('--format <format>', 'table|json|csv', parseFormat, 'table')
    .option('--out <path>', 'Output file')
    .option('--max-rows <number>', 'Output row limit', parsePositiveInteger)
    .action(async (connection: string, sql: string | undefined, options) => {
        await new QueryCommand().execute(connection, sql, options);
    });

program
    .command('tables')
    .argument('<connection>', 'Connection name')
    .option('--schema <schema>', 'Schema name')
    .option('--format <format>', 'table|json|csv', parseFormat, 'table')
    .option('--out <path>', 'Output file')
    .option('--max-rows <number>', 'Output row limit', parsePositiveInteger)
    .action(async (connection: string, options) => {
        await new TablesCommand().execute(connection, options);
    });

program
    .command('describe')
    .argument('<connection>', 'Connection name')
    .argument('<table>', 'Table name')
    .option('--format <format>', 'table|json|csv', parseFormat, 'table')
    .option('--out <path>', 'Output file')
    .option('--max-rows <number>', 'Output row limit', parsePositiveInteger)
    .action(async (connection: string, table: string, options) => {
        await new DescribeCommand().execute(connection, table, options);
    });

program
    .command('protheus')
    .argument('<connection>', 'Connection name')
    .argument('<table>', 'Protheus table alias')
    .option('--format <format>', 'table|json|csv', parseFormat, 'table')
    .option('--out <path>', 'Output file')
    .option('--max-rows <number>', 'Output row limit', parsePositiveInteger)
    .action(async (connection: string, table: string, options) => {
        await new ProtheusMetadataCommand().execute(connection, table, options);
    });

program.parseAsync().catch((error: unknown) => {
    console.error(ErrorFormatter.format(error));
    process.exit(1);
});
