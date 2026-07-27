import { Readable } from 'node:stream';

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
            // mssql defaults requestTimeout to 15s, meant for interactive
            // queries. This CLI is routinely used for long-running exports
            // and batched writes (backups of huge tables, multi-table
            // delete scripts) that produce no output until they're done, so
            // the default kills them well before completion. Disabled here
            // (0 = no timeout); connectionTimeout is left at its default
            // since a slow/unreachable server should still fail fast.
            requestTimeout: 0,
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

    public streamQuery(sqlText: string): Readable {
        if (!this.pool) {
            throw new Error('Database is not connected.');
        }

        const request = this.pool.request();
        request.stream = true;

        // Readable's `read()` is only invoked when the consumer is ready for
        // more data, so it doubles as the resume signal; `push()` returning
        // false means the internal buffer is full and we must pause the
        // underlying mssql request until the consumer catches up.
        const readable = new Readable({
            objectMode: true,
            read() {
                request.resume();
            },
        });

        request.pause();

        request.on('row', (row: Record<string, unknown>) => {
            if (!readable.push(row)) {
                request.pause();
            }
        });

        request.on('error', (err: Error) => {
            readable.destroy(err);
        });

        request.on('done', () => {
            readable.push(null);
        });

        request.query(sqlText);

        return readable;
    }
}

ProviderRegistry.register('sqlserver', SqlServerProvider);
