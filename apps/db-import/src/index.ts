import { createDatabase, ensureDatabaseSchema } from "@cs-4347/database";
import type { Author, Book, BookAuthor, Borrower, Database } from "@cs-4347/db-schema";
import { parse } from "csv/sync";
import type { Kysely } from "kysely";

const INPUT_DIR = "./data/normalized";

export const PATHS = {
    borrowers: `${INPUT_DIR}/borrowers.csv`,
    books: `${INPUT_DIR}/books.csv`,
    authors: `${INPUT_DIR}/authors.csv`,
    bookAuthors: `${INPUT_DIR}/book_authors.csv`,
};

type CsvRow<T> = { [K in keyof T]: string };

export async function readCsv<T>(filePath: string): Promise<CsvRow<T>[]> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
        throw new Error(
            `Normalized CSV file not found at "${filePath}". Run "bun run normalize" first.`,
        );
    }

    return parse(await file.text(), {
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

        if (borrowers.length > 0) await trx.insertInto("borrowers").values(borrowers).execute();
        if (books.length > 0) await trx.insertInto("books").values(books).execute();
        if (authors.length > 0) await trx.insertInto("authors").values(authors).execute();
        if (bookAuthors.length > 0)
            await trx.insertInto("book_authors").values(bookAuthors).execute();
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

if (import.meta.main) {
    await main();
}
