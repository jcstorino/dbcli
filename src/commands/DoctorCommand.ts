import { DoctorService } from '../core/DoctorService.js';
import { OutputFormat, ResultRenderer } from '../core/ResultRenderer.js';

interface DoctorCommandOptions {
    format: OutputFormat;
    out?: string;
    maxRows?: number;
}

export class DoctorCommand {
    public async execute(
        connectionName: string,
        options: DoctorCommandOptions
    ): Promise<void> {
        const result = await new DoctorService().run(connectionName);

        ResultRenderer.render(result, {
            format: options.format,
            out: options.out,
            maxRows: options.maxRows,
        });
    }
}
