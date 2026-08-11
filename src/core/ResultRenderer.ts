import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

    /**
     * Streaming counterpart of render() for the CSV+file case: rows flow
     * one at a time from the DB through a CSV-formatting Transform straight
     * into the output file, so memory usage stays O(1) instead of O(table
     * size) regardless of how large the export is.
     */
    public static async renderCsvToFile(
        rowStream: Readable,
        outPath: string
    ): Promise<number> {
        let columns: string[] | null = null;
        let rowCount = 0;

        const csvTransform = new Transform({
            writableObjectMode: true,
            transform(row: Record<string, unknown>, _encoding, callback) {
                const lines: string[] = [];

                if (!columns) {
                    columns = ResultRenderer.getColumns([row]);
                    lines.push(
                        columns.map((column) => ResultRenderer.escapeCsv(column)).join(',')
                    );
                }

                lines.push(
                    columns
                        .map((column) =>
                            ResultRenderer.escapeCsv(ResultRenderer.formatCell(row[column]))
                        )
                        .join(',')
                );

                rowCount += 1;
                callback(null, `${lines.join('\n')}\n`);
            },
        });

        // Writing straight to `outPath` couples the DB read speed to the
        // destination disk's write speed: whenever the destination stalls
        // (e.g. a cloud-synced folder like iCloud Drive/OneDrive throttling
        // large files), backpressure pauses the SQL stream, and if it stays
        // paused too long the DB connection gets dropped as idle
        // (`read ETIMEDOUT`). Writing to a local temp file first — always
        // fast, never cloud-synced — keeps the SQL stream flowing, then a
        // single OS-level copy lands the finished file at `outPath`.
        const tempPath = path.join(
            os.tmpdir(),
            `dbcli-${crypto.randomUUID()}-${path.basename(outPath)}`
        );

        try {
            await pipeline(rowStream, csvTransform, fs.createWriteStream(tempPath, { encoding: 'utf8' }));

            try {
                fs.renameSync(tempPath, outPath);
            } catch {
                // Cross-device (EXDEV): temp dir and destination are on
                // different filesystems, so fall back to copy + delete.
                fs.copyFileSync(tempPath, outPath);
                fs.unlinkSync(tempPath);
            }
        } catch (err) {
            fs.rmSync(tempPath, { force: true });
            throw err;
        }

        return rowCount;
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
