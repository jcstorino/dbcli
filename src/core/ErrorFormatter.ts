interface SqlServerLikeError extends Error {
    code?: string;
    number?: number;
    originalError?: {
        info?: {
            message?: string;
        };
    };
}

export class ErrorFormatter {
    public static format(error: unknown): string {
        if (error instanceof Error) {
            return this.formatError(error as SqlServerLikeError);
        }

        return String(error);
    }

    private static formatError(error: SqlServerLikeError): string {
        if (error.code === 'EREQUEST' && error.number === 208) {
            const objectName = this.extractObjectName(error);

            if (objectName) {
                return [
                    `Objeto não encontrado: ${objectName}`,
                    'Verifique o nome físico da tabela e o schema.',
                    'Para Protheus, consulte primeiro:',
                    '- db protheus <conexao> <alias>',
                    '- db tables <conexao>',
                    '- db describe <conexao> <tabela_fisica>',
                ].join('\n');
            }
        }

        return error.message;
    }

    private static extractObjectName(error: SqlServerLikeError): string | null {
        const rawMessage =
            error.originalError?.info?.message ??
            error.message;

        const match = rawMessage.match(/Invalid object name '([^']+)'/i);

        return match?.[1] ?? null;
    }
}
