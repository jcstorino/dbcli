const BLOCKED_TOKENS = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'MERGE',
    'TRUNCATE',
    'CREATE',
    'ALTER',
    'DROP',
    'RENAME',
];

export class SqlSafetyGuard {
    public static assertSafe(sql: string, allowWrite = false): void {
        if (allowWrite) {
            return;
        }

        const normalized = this.normalize(sql);

        for (const token of BLOCKED_TOKENS) {
            const pattern = new RegExp(`(^|\\s|;)${token}(\\s|$)`, 'i');

            if (pattern.test(normalized)) {
                throw new Error(
                    `SQL bloqueado pelo modo safe: '${token}'. Use --allow-write para liberar.`
                );
            }
        }
    }

    private static normalize(sql: string): string {
        return sql
            .replaceAll(/\/\*[\s\S]*?\*\//g, ' ')
            .replaceAll(/--.*$/gm, ' ')
            .replaceAll(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }
}
