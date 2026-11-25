import { readFile } from "node:fs/promises";
import { createDatabase, ensureDatabaseSchema } from "@cs-4347/db-operations";
import type { Author, Book, BookAuthor, Borrower, Database } from "@cs-4347/db-schema";
import { parse } from "csv/sync";
import type { Kysely } from "kysely";

const INPUT_DIR = "./data/normalized";
const INSERT_CHUNK_SIZE = 500;

export const PATHS = {
    borrowers: `${INPUT_DIR}/borrowers.csv`,
    books: `${INPUT_DIR}/books.csv`,
    authors: `${INPUT_DIR}/authors.csv`,
    bookAuthors: `${INPUT_DIR}/book_authors.csv`,
};

type CsvRow<T> = { [K in keyof T]: string };

function chunkRows<T>(rows: readonly T[], size = INSERT_CHUNK_SIZE): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

export async function readCsv<T>(filePath: string): Promise<CsvRow<T>[]> {
    let text: string;
    try {
        text = await readFile(filePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(
                `Normalized CSV file not found at "${filePath}". Run "npm run normalize" (or "bun run normalize") first.`,
            );
        }
        throw error;
    }

    return parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CsvRow<T>[];
}

export async function importAll(db: Kysely<Database>, paths = PATHS) {
    const borrowers = await readCsv<Borrower>(paths.borrowers);
    const books = await readCsv<Book>(paths.books);
    const authors: Author[] = (await readCsv<Author>(paths.authors)).map((row) => ({
        author_id: Number(row.author_id),
        name: row.name,
    }));
    const bookAuthors: BookAuthor[] = (await readCsv<BookAuthor>(paths.bookAuthors)).map((row) => ({
        isbn: row.isbn,
        author_id: Number(row.author_id),
    }));

    await ensureDatabaseSchema(db);

    await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("book_authors").execute();
        await trx.deleteFrom("authors").execute();
        await trx.deleteFrom("books").execute();
        await trx.deleteFrom("borrowers").execute();

        for (const chunk of chunkRows(borrowers)) {
            await trx.insertInto("borrowers").values(chunk).execute();
        }
        for (const chunk of chunkRows(books)) {
            await trx.insertInto("books").values(chunk).execute();
        }
        for (const chunk of chunkRows(authors)) {
            await trx.insertInto("authors").values(chunk).execute();
        }
        for (const chunk of chunkRows(bookAuthors)) {
            await trx.insertInto("book_authors").values(chunk).execute();
        }
    });

    return {
        borrowers: borrowers.length,
        books: books.length,
        authors: authors.length,
        bookAuthors: bookAuthors.length,
    };
}

export async function main(): Promise<void> {
    const db = createDatabase();
    try {
        const summary = await importAll(db);
        console.log(
            `Import complete: ${summary.borrowers} borrowers, ${summary.books} books, ${summary.authors} authors, ${summary.bookAuthors} book_authors.`,
        );
    } finally {
        await db.destroy();
    }
}
