import type { Database } from "@cs-4347/db-schema";
import { Kysely, SqliteDialect } from "kysely";
import { createNodeSqliteDatabase } from "./sqlite-adapter";

export { ensureDatabaseSchema } from "./schema";
export { createNodeSqliteDatabase } from "./sqlite-adapter";

export const DEFAULT_SQLITE_PATH = "./data/library.sqlite";

export function resolveSqlitePath(
    sqlitePath?: string,
    env: Record<string, string | undefined> = process.env,
): string {
    return sqlitePath ?? env["DB_PATH"] ?? DEFAULT_SQLITE_PATH;
}

export function createDatabase(sqlitePath?: string): Kysely<Database> {
    return new Kysely<Database>({
        dialect: new SqliteDialect({
            database: createNodeSqliteDatabase(resolveSqlitePath(sqlitePath)),
        }),
    });
}
