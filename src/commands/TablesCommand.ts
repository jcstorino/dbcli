import { DatabaseService } from '../core/DatabaseService.js';
import { OutputFormat, ResultRenderer } from '../core/ResultRenderer.js';

interface TablesCommandOptions {
    format: OutputFormat;
    out?: string;
    schema?: string;
    maxRows?: number;
}

export class TablesCommand {
    public async execute(
        connectionName: string,
        options: TablesCommandOptions
    ): Promise<void> {
        const service = DatabaseService.create(connectionName);
        const result = await service.listTables(options.schema);

        ResultRenderer.render(result, {
            format: options.format,
            out: options.out,
            maxRows: options.maxRows,
        });
    }
}
