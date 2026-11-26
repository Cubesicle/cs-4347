import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

export * from "./schema";

export const DEFAULT_SQLITE_PATH = "./data/library.sqlite";

export type AppDatabase = NodeSQLiteDatabase & { $client: DatabaseSync };

export function resolveSqlitePath(
    sqlitePath?: string,
    env: Record<string, string | undefined> = process.env,
): string {
    return sqlitePath ?? env["DB_PATH"] ?? DEFAULT_SQLITE_PATH;
}

/** Creates the normalized SQLite tables if they do not already exist. */
export function ensureDatabaseSchema(db: AppDatabase): void {
    db.$client.exec(`
        CREATE TABLE IF NOT EXISTS borrowers (
            card_id TEXT PRIMARY KEY NOT NULL,
            ssn TEXT NOT NULL,
            bname TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS books (
            isbn TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS authors (
            author_id INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS book_authors (
            isbn TEXT NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
            author_id INTEGER NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
            PRIMARY KEY (isbn, author_id)
        );
    `);
}

export function createDatabase(sqlitePath?: string): AppDatabase {
    const filename = resolveSqlitePath(sqlitePath);
    if (filename !== ":memory:") {
        mkdirSync(dirname(filename), { recursive: true });
    }

    const client = new DatabaseSync(filename);
    client.exec("PRAGMA foreign_keys = ON;");

    const db = drizzle({ client });
    ensureDatabaseSchema(db);
    return db;
}
