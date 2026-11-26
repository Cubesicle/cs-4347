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

/** Creates the library SQLite schema tables and indexes if they do not already exist. */
export function ensureDatabaseSchema(db: AppDatabase): void {
    db.$client.exec(`
        CREATE TABLE IF NOT EXISTS book (
            isbn TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS authors (
            author_id INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS book_authors (
            author_id INTEGER NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
            isbn TEXT NOT NULL REFERENCES book(isbn) ON DELETE CASCADE,
            PRIMARY KEY (author_id, isbn)
        );
        CREATE INDEX IF NOT EXISTS idx_book_authors_isbn ON book_authors (isbn);

        CREATE TABLE IF NOT EXISTS borrower (
            card_id TEXT PRIMARY KEY NOT NULL,
            ssn TEXT NOT NULL UNIQUE,
            bname TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT
        );

        CREATE TABLE IF NOT EXISTS book_loans (
            loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            isbn TEXT NOT NULL REFERENCES book(isbn) ON DELETE RESTRICT,
            card_id TEXT NOT NULL REFERENCES borrower(card_id) ON DELETE RESTRICT,
            date_out TEXT NOT NULL,
            due_date TEXT NOT NULL,
            date_in TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_book_loans_active_isbn
            ON book_loans (isbn)
            WHERE date_in IS NULL;
        CREATE INDEX IF NOT EXISTS idx_book_loans_card_id ON book_loans (card_id);
        CREATE INDEX IF NOT EXISTS idx_book_loans_isbn ON book_loans (isbn);

        CREATE TABLE IF NOT EXISTS fines (
            loan_id INTEGER PRIMARY KEY NOT NULL REFERENCES book_loans(loan_id) ON DELETE CASCADE,
            fine_amt DECIMAL(10, 2) NOT NULL CHECK (fine_amt >= 0),
            paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1))
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
