import { Readable, Transform } from "node:stream";
import { parse, stringify, transform } from "csv";

interface Borrower {
    ID0000id: string;
    ssn: string;
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
}

interface Book {
    ISBN10: string;
    ISBN13: string;
    Title: string;
    Author: string;
    Publisher: string;
    Pages: number;
}

// Maps normalized author names to their IDs.
const authorIds = new Map<string, number>();

// Ensures author names use consistent keys in the map.
function normalizeAuthorKey(author: string): string {
    return author.trim().replace(/\s+/g, " ").normalize("NFC").toLowerCase();
}

function formatAuthors(authorEntry: string): string[] {
    if (!authorEntry || !authorEntry.trim()) {
        return [];
    }

    const cleanedEntry = authorEntry.replace(/"/g, "").trim();
    const authors: string[] = [];

    if (cleanedEntry.includes(";")) {
        const parts = cleanedEntry.split(";");

        for (const part of parts) {
            const trimmedPart = part.trim();

            if (!trimmedPart) {
                continue;
            }

            const commaParts = trimmedPart.split(",");

            if (commaParts.length === 2) {
                const lastName = commaParts[0]?.trim();
                const firstName = commaParts[1]?.trim();

                if (lastName && firstName) {
                    authors.push(`${firstName} ${lastName}`);
                }
            } else {
                authors.push(trimmedPart);
            }
        }
    } else {
        authors.push(
            ...cleanedEntry.split(",").map(author => author.trim())
        );
    }

    return authors.filter(author => author.length > 0);
}

// Normalizes data into borrowers.csv
async function normalizeBorrowers() {
    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const borrowersReader = Bun.file("./borrowers.csv").stream();

    const path = "./normalized/borrowers.csv";
    await Bun.write(path, "");
    const borrowersWriter = Bun.file(path).writer();

    const pipeline = Readable.from(borrowersReader)
        .pipe(parser)
        .pipe(
            transform((row: Borrower) => {
                return {
                    Card_id: row.ID0000id,
                    Ssn: row.ssn,
                    Bname: `${row.first_name} ${row.last_name}`,
                    Address: [row.address, row.city, row.state].join(", "),
                    Phone: row.phone,
                };
            }),
        )
        .pipe(
            stringify({
                header: true,
                quoted: false,
            }),
        );

    for await (const chunk of pipeline) {
        borrowersWriter.write(chunk);
    }

    borrowersWriter.end();

    console.log("borrowers.csv finished");
}

// Normalizes data into books.csv
async function normalizeBooks() {
    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();

    const path = "./normalized/books.csv";
    await Bun.write(path, "");
    const booksWriter = Bun.file(path).writer();

    const pipeline = Readable.from(booksReader)
        .pipe(parser)
        .pipe(
            transform((row: Book) => {
                return {
                    Isbn: row.ISBN13,
                    Title: row.Title,
                };
            }),
        )
        .pipe(
            stringify({
                header: true,
                quoted: false,
            }),
        );

    for await (const chunk of pipeline) {
        booksWriter.write(chunk);
    }

    booksWriter.end();

    console.log("books.csv finished");
}

// Normalizes data into authors.csv
async function normalizeAuthors() {
    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();

    const path = "./normalized/authors.csv";
    await Bun.write(path, "");
    const booksWriter = Bun.file(path).writer();

    // Reset the shared map in case this function is run again.
    authorIds.clear();

    let nextAuthorId = 1;

    const authorTransform = new Transform({
        objectMode: true,

        transform(row: Book, encoding, callback) {
            const authors = formatAuthors(row.Author);

            for (const author of authors) {
                const name = author.trim();
                const normalizedName = normalizeAuthorKey(name);

                if (!name || authorIds.has(normalizedName)) {
                    continue;
                }

                const authorId = nextAuthorId++;

                // Store the author ID in the shared map.
                authorIds.set(normalizedName, authorId);

                this.push({
                    Author_id: authorId,
                    Name: name,
                });
            }

            callback();
        },
    });

    const pipeline = Readable.from(booksReader)
        .pipe(parser)
        .pipe(authorTransform)
        .pipe(
            stringify({
                header: true,
                quoted: false,
            }),
        );

    for await (const chunk of pipeline) {
        booksWriter.write(chunk);
    }

    booksWriter.end();

    console.log("authors.csv finished");
}

// Normalizes data into book_authors.csv
async function normalizeBook_Authors() {
    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();

    const path = "./normalized/book_authors.csv";
    await Bun.write(path, "");
    const booksWriter = Bun.file(path).writer();

    const bookAuthorsTransform = new Transform({
        objectMode: true,

        transform(row: Book, encoding, callback) {
            const authors = formatAuthors(row.Author);

            // Prevent duplicate relationships within the same book.
            const processedAuthors = new Set<string>();

            for (const author of authors) {
                const normalizedName = normalizeAuthorKey(author);

                if (processedAuthors.has(normalizedName)) {
                    continue;
                }

                processedAuthors.add(normalizedName);

                const authorId = authorIds.get(normalizedName);

                if (authorId === undefined) {
                    callback(
                        new Error(`Author ID not found for: "${author}"`)
                    );
                    return;
                }

                this.push({
                    Isbn: row.ISBN13,
                    Author_id: authorId,
                });
            }

            callback();
        },
    });

    const pipeline = Readable.from(booksReader)
        .pipe(parser)
        .pipe(bookAuthorsTransform)
        .pipe(
            stringify({
                header: true,
                quoted: false,
            }),
        );

    for await (const chunk of pipeline) {
        booksWriter.write(chunk);
    }

    booksWriter.end();

    console.log("book_authors.csv finished");
}

// Run all normalization functions in the correct order.
async function main() {
    await normalizeBorrowers();
    await normalizeBooks();

    // Must run before normalizeBook_Authors.
    await normalizeAuthors();
    await normalizeBook_Authors();

    console.log("All Files Complete!");
}

await main();