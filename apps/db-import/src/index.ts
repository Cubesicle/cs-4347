import {
    type AppDatabase,
    type Author,
    authors as authorsTable,
    type Book,
    type BookAuthor,
    type Borrower,
    bookAuthors as bookAuthorsTable,
    bookLoans as bookLoansTable,
    books as booksTable,
    borrowers as borrowersTable,
    createDatabase,
    ensureDatabaseSchema,
    fines as finesTable,
} from "@cs-4347/db";
import { parse } from "csv/sync";

const INPUT_DIR = "./data/normalized";
const INSERT_BATCH_SIZE = 500;

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

function chunk<T>(items: readonly T[], size = INSERT_BATCH_SIZE): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
}

export async function importAll(db: AppDatabase, paths = PATHS) {
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

    ensureDatabaseSchema(db);

    db.transaction((tx) => {
        tx.delete(finesTable).run();
        tx.delete(bookLoansTable).run();
        tx.delete(bookAuthorsTable).run();
        tx.delete(authorsTable).run();
        tx.delete(booksTable).run();
        tx.delete(borrowersTable).run();

        for (const batch of chunk(borrowers)) tx.insert(borrowersTable).values(batch).run();
        for (const batch of chunk(books)) tx.insert(booksTable).values(batch).run();
        for (const batch of chunk(authors)) tx.insert(authorsTable).values(batch).run();
        for (const batch of chunk(bookAuthors)) tx.insert(bookAuthorsTable).values(batch).run();
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
        db.$client.close();
    }
}

if (import.meta.main) {
    await main();
}
