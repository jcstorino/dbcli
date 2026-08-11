import { Readable } from 'node:stream';

import { ConfigLoader } from '../config/ConfigLoader.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { DatabaseProvider } from '../providers/DatabaseProvider.js';
import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { QueryResult } from '../types/QueryResult.js';

interface QualifiedTableName {
    schema?: string;
    table: string;
}

export class DatabaseService {
    private constructor(
        private readonly config: ConnectionConfig,
        private readonly provider: DatabaseProvider
    ) {}

    public static create(connectionName: string): DatabaseService {
        const config = ConfigLoader.load(connectionName);
        const provider = ProviderRegistry.create(config);

        return new DatabaseService(config, provider);
    }

    public async testConnection(): Promise<void> {
        await this.withConnection(async () => {
            await this.provider.execute('SELECT 1 AS ok');
        });
    }

    public async executeQuery(sql: string): Promise<QueryResult> {
        return this.withConnection(async () => this.provider.execute(sql));
    }

    /**
     * Like executeQuery, but yields rows one at a time instead of buffering
     * the whole result set. The connection is kept open for as long as the
     * returned stream is being consumed and is closed once it ends/errors.
     */
    public async executeQueryStream(sql: string): Promise<Readable> {
        await this.provider.connect(this.config);

        const stream = this.provider.streamQuery(sql);
        let closed = false;

        const close = () => {
            if (closed) {
                return;
            }

            closed = true;
            void this.provider.disconnect();
        };

        stream.once('close', close);
        stream.once('error', close);

        return stream;
    }

    public async listTables(schema?: string): Promise<QueryResult> {
        const schemaFilter = schema
            ? `AND TABLE_SCHEMA = '${this.escapeLiteral(schema)}'`
            : '';

        return this.withConnection(async () =>
            this.provider.execute(`
                SELECT
                    TABLE_SCHEMA AS [schema],
                    TABLE_NAME AS [table],
                    TABLE_TYPE AS [type]
                FROM INFORMATION_SCHEMA.TABLES
                WHERE 1 = 1
                    ${schemaFilter}
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            `)
        );
    }

    public async describeTable(tableName: string): Promise<QueryResult> {
        const { schema, table } = this.parseQualifiedTableName(tableName);
        const schemaFilter = schema
            ? `AND c.TABLE_SCHEMA = '${this.escapeLiteral(schema)}'`
            : '';

        return this.withConnection(async () =>
            this.provider.execute(`
                SELECT
                    c.TABLE_SCHEMA AS [schema],
                    c.TABLE_NAME AS [table],
                    c.COLUMN_NAME AS [column],
                    c.DATA_TYPE AS [type],
                    c.CHARACTER_MAXIMUM_LENGTH AS [maxLength],
                    c.NUMERIC_PRECISION AS [precision],
                    c.NUMERIC_SCALE AS [scale],
                    c.IS_NULLABLE AS [nullable],
                    c.COLUMN_DEFAULT AS [defaultValue],
                    CASE
                        WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES'
                        ELSE 'NO'
                    END AS [primaryKey]
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON ku.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                        AND ku.TABLE_SCHEMA = tc.TABLE_SCHEMA
                        AND ku.TABLE_NAME = tc.TABLE_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                ) pk
                    ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
                    AND pk.TABLE_NAME = c.TABLE_NAME
                    AND pk.COLUMN_NAME = c.COLUMN_NAME
                WHERE c.TABLE_NAME = '${this.escapeLiteral(table)}'
                    ${schemaFilter}
                ORDER BY c.ORDINAL_POSITION
            `)
        );
    }

    public async getProtheusMetadata(tableAlias: string): Promise<QueryResult> {
        return this.withConnection(async () => {
            const normalizedAlias = this.sanitizeIdentifier(tableAlias).toUpperCase();
            const sx2Table = await this.resolveDictionaryTable('SX2');
            const sx3Table = await this.resolveDictionaryTable('SX3');

            const dictionaryRows = await this.provider.execute(`
                SELECT
                    x2.X2_CHAVE AS [table],
                    x2.X2_NOME AS [tableDescription],
                    x3.X3_CAMPO AS [field],
                    x3.X3_TITULO AS [title],
                    x3.X3_DESCRIC AS [description],
                    x3.X3_TIPO AS [type],
                    x3.X3_TAMANHO AS [length],
                    x3.X3_DECIMAL AS [decimals],
                    x3.X3_ORDEM AS [order]
                FROM ${sx2Table} x2
                INNER JOIN ${sx3Table} x3
                    ON x3.X3_ARQUIVO = x2.X2_CHAVE
                WHERE x2.X2_CHAVE = '${this.escapeLiteral(normalizedAlias)}'
                ORDER BY x3.X3_ORDEM, x3.X3_CAMPO
            `);

            return dictionaryRows;
        });
    }

    private async resolveDictionaryTable(baseName: string): Promise<string> {
        const safeName = this.sanitizeIdentifier(baseName).toUpperCase();
        const result = await this.provider.execute(`
            SELECT TOP (1)
                name
            FROM sys.tables
            WHERE name LIKE '${safeName}%'
            ORDER BY
                CASE
                    WHEN name = '${safeName}990' THEN 0
                    WHEN name = '${safeName}010' THEN 1
                    WHEN name = '${safeName}' THEN 2
                    ELSE 3
                END,
                name
        `);

        const tableName = result.rows[0]?.name;

        if (typeof tableName !== 'string') {
            throw new Error(`Tabela de dicionário '${safeName}' não encontrada.`);
        }

        return this.sanitizeIdentifier(tableName);
    }

    private parseQualifiedTableName(tableName: string): QualifiedTableName {
        const parts = tableName.split('.').map((part) => part.trim()).filter(Boolean);

        if (parts.length === 1) {
            return {
                table: this.sanitizeIdentifier(parts[0]),
            };
        }

        if (parts.length === 2) {
            return {
                schema: this.sanitizeIdentifier(parts[0]),
                table: this.sanitizeIdentifier(parts[1]),
            };
        }

        throw new Error(`Nome de tabela inválido: '${tableName}'.`);
    }

    private sanitizeIdentifier(value: string): string {
        if (!/^[A-Za-z0-9_]+$/.test(value)) {
            throw new Error(`Identificador inválido: '${value}'.`);
        }

        return value;
    }

    private escapeLiteral(value: string): string {
        return value.replaceAll("'", "''");
    }

    private async withConnection<T>(callback: () => Promise<T>): Promise<T> {
        await this.provider.connect(this.config);

        try {
            return await callback();
        } finally {
            await this.provider.disconnect();
        }
    }
}
