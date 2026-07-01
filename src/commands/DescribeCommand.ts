import { DatabaseService } from '../core/DatabaseService.js';
import { OutputFormat, ResultRenderer } from '../core/ResultRenderer.js';

interface DescribeCommandOptions {
    format: OutputFormat;
    out?: string;
    maxRows?: number;
}

export class DescribeCommand {
    public async execute(
        connectionName: string,
        tableName: string,
        options: DescribeCommandOptions
    ): Promise<void> {
        const service = DatabaseService.create(connectionName);
        const result = await service.describeTable(tableName);

        ResultRenderer.render(result, {
            format: options.format,
            out: options.out,
            maxRows: options.maxRows,
        });
    }
}
