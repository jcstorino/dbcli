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

        // CSV exports to a file skip the buffered path entirely: large
        // tables used to be fully materialized in memory (recordset + CSV
        // lines + joined string) before being written, which could exhaust
        // the heap. maxRows still uses the buffered path since it's meant
        // for quick previews, not full-table exports.
        if (options.format === 'csv' && options.out && !options.maxRows) {
            const rowStream = await service.executeQueryStream(sqlText);
            const rowCount = await ResultRenderer.renderCsvToFile(rowStream, options.out);
            console.log(`${options.out} (${rowCount} linhas)`);
            return;
        }

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
