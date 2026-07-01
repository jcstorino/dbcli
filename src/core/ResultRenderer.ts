import fs from 'node:fs';

import Table from 'cli-table3';

import { QueryResult } from '../types/QueryResult.js';

export type OutputFormat = 'table' | 'json' | 'csv';

interface RenderOptions {
    format: OutputFormat;
    out?: string;
    maxRows?: number;
}

export class ResultRenderer {
    public static render(result: QueryResult, options: RenderOptions): void {
        const rows = this.applyLimit(result.rows, options.maxRows);
        const output = this.serialize({ ...result, rows }, options.format);

        if (options.out) {
            fs.writeFileSync(options.out, output, 'utf8');
            console.log(options.out);
            return;
        }

        console.log(output);
    }

    private static serialize(
        result: QueryResult,
        format: OutputFormat
    ): string {
        switch (format) {
            case 'json':
                return JSON.stringify(
                    {
                        rowCount: result.rowCount,
                        displayedRows: result.rows.length,
                        rows: result.rows,
                    },
                    null,
                    2
                );
            case 'csv':
                return this.toCsv(result.rows);
            case 'table':
            default:
                return this.toTable(result);
        }
    }

    private static toTable(result: QueryResult): string {
        if (result.rows.length === 0) {
            return `0 rows`;
        }

        const columns = this.getColumns(result.rows);
        const table = new Table({
            head: columns,
            wordWrap: true,
        });

        for (const row of result.rows) {
            table.push(
                columns.map((column) => this.formatCell(row[column]))
            );
        }

        return `${table.toString()}\n${result.rows.length}/${result.rowCount} rows`;
    }

    private static toCsv(rows: Record<string, unknown>[]): string {
        if (rows.length === 0) {
            return '';
        }

        const columns = this.getColumns(rows);
        const lines = [
            columns.map((column) => this.escapeCsv(column)).join(','),
        ];

        for (const row of rows) {
            lines.push(
                columns
                    .map((column) => this.escapeCsv(this.formatCell(row[column])))
                    .join(',')
            );
        }

        return lines.join('\n');
    }

    private static getColumns(rows: Record<string, unknown>[]): string[] {
        const columns = new Set<string>();

        for (const row of rows) {
            for (const key of Object.keys(row)) {
                columns.add(key);
            }
        }

        return [...columns];
    }

    private static formatCell(value: unknown): string {
        if (value === null || value === undefined) {
            return '';
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    private static escapeCsv(value: string): string {
        return `"${value.replaceAll('"', '""')}"`;
    }

    private static applyLimit(
        rows: Record<string, unknown>[],
        maxRows?: number
    ): Record<string, unknown>[] {
        if (!maxRows || maxRows < 1) {
            return rows;
        }

        return rows.slice(0, maxRows);
    }
}
