import fs from 'node:fs';

import { DatabaseService } from '../core/DatabaseService.js';
import { OutputFormat, ResultRenderer } from '../core/ResultRenderer.js';
import { SqlSafetyGuard } from '../core/SqlSafetyGuard.js';

interface QueryCommandOptions {
    allowWrite?: boolean;
    file?: string;
    format: OutputFormat;
    out?: string;
    maxRows?: number;
}

export class QueryCommand {
    public async execute(
        connectionName: string,
        sql: string | undefined,
        options: QueryCommandOptions
    ): Promise<void> {
        const service = DatabaseService.create(connectionName);
        const sqlText = this.resolveSql(sql, options.file);
        SqlSafetyGuard.assertSafe(sqlText, options.allowWrite);
        const result = await service.executeQuery(sqlText);

        ResultRenderer.render(result, {
            format: options.format,
            out: options.out,
            maxRows: options.maxRows,
        });
    }

    private resolveSql(sql: string | undefined, file?: string): string {
        if (file) {
            return fs.readFileSync(file, 'utf8');
        }

        if (!sql) {
            throw new Error('Informe SQL ou use --file.');
        }

        return sql;
    }
}
