import sql from 'mssql';

import { ProviderRegistry } from './ProviderRegistry.js';
import { DatabaseProvider } from './DatabaseProvider.js';
import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { QueryResult } from '../types/QueryResult.js';

export class SqlServerProvider implements DatabaseProvider {
    private pool: sql.ConnectionPool | null = null;

    public async connect(config: ConnectionConfig): Promise<void> {
        this.pool = await sql.connect({
            server: config.server,
            port: config.port ?? 1433,
            database: config.database,
            user: config.username,
            password: config.password,
            options: {
                encrypt: config.encrypt ?? false,
                trustServerCertificate: config.trustServerCertificate ?? true,
            },
        });
    }

    public async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    public async execute(sqlText: string): Promise<QueryResult> {
        if (!this.pool) {
            throw new Error('Database is not connected.');
        }

        const result = await this.pool.request().query(sqlText);

        return {
            rows: result.recordset ?? [],
            rowCount: result.rowsAffected?.[0] ?? result.recordset.length ?? 0,
        };
    }
}

ProviderRegistry.register('sqlserver', SqlServerProvider);
