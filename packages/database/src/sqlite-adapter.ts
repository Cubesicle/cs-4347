import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteDatabase, SqliteStatement } from "kysely";

/**
 * Wraps Node's built-in `node:sqlite` (`DatabaseSync`) into the `SqliteDatabase`
 * interface expected by Kysely's `SqliteDialect`. Works in both Node 22+ and Bun.
 */
export function createNodeSqliteDatabase(filename: string): SqliteDatabase {
    if (filename !== ":memory:") {
        mkdirSync(dirname(filename), { recursive: true });
    }

    const db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON;");

    return {
        close: () => db.close(),
        prepare: (sql: string): SqliteStatement => {
            const stmt = db.prepare(sql);
            const reader = stmt.columns().length > 0;

            return {
                reader,
                all: (parameters) =>
                    stmt.all(...(parameters as SQLInputValue[])).map((row) => ({ ...row })),
                run: (parameters) => stmt.run(...(parameters as SQLInputValue[])),
                iterate: (parameters) =>
                    (function* () {
                        for (const row of stmt.iterate(...(parameters as SQLInputValue[]))) {
                            yield { ...row };
                        }
                    })(),
            };
        },
    };
}
