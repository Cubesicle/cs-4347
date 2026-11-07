import { Readable, Transform } from "node:stream";
import { parse, stringify, transform } from "csv";

const INPUT_DIR = "./data-original";
const OUTPUT_DIR = "./data-normalized";

const PATHS = {
    input: {
        borrowers: `${INPUT_DIR}/borrowers.csv`,
        books: `${INPUT_DIR}/books.csv`,
    },
    output: {
        borrowers: `${OUTPUT_DIR}/borrowers.csv`,
        books: `${OUTPUT_DIR}/books.csv`,
        authors: `${OUTPUT_DIR}/authors.csv`,
        bookAuthors: `${OUTPUT_DIR}/book_authors.csv`,
    },
};

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
    return author
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

function formatAuthors(authorEntry: string): string[] {
    if (!authorEntry?.trim()) {
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
        authors.push(...cleanedEntry.split(",").map((author) => author.trim()));
    }

    return authors.filter((author) => author.length > 0);
}

function createCsvParser() {
    return parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
}

function createCsvStringifier() {
    return stringify({
        header: true,
        quoted: false,
    });
}

// Streams a CSV file from inputPath, transforms rows using the given transformer,
// and writes the result to outputPath as a CSV file.
async function processCsvFile<TInput = unknown, TOutput = unknown>(
    inputPath: string,
    outputPath: string,
    transformer: Transform | ((row: TInput) => TOutput),
): Promise<void> {
    const transformStream =
        typeof transformer === "function" ? transform(transformer) : transformer;

    const reader = Bun.file(inputPath).stream();
    await Bun.write(outputPath, "");
    const writer = Bun.file(outputPath).writer();

    const pipeline = Readable.from(reader)
        .pipe(createCsvParser())
        .pipe(transformStream)
        .pipe(createCsvStringifier());

    for await (const chunk of pipeline) {
        writer.write(chunk);
    }

    writer.end();
}

function mapBorrower(row: Borrower) {
    return {
        card_id: row.ID0000id,
        ssn: row.ssn,
        bname: `${row.first_name} ${row.last_name}`,
        address: [row.address, row.city, row.state].join(", "),
        phone: row.phone,
    };
}

function mapBook(row: Book) {
    return {
        isbn: row.ISBN13,
        title: row.Title,
    };
}

function createAuthorsTransform(): Transform {
    let nextAuthorId = 0;

    return new Transform({
        objectMode: true,

        transform(row: Book, _encoding, callback) {
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
                    author_id: authorId,
                    name: name,
                });
            }

            callback();
        },
    });
}

function createBookAuthorsTransform(): Transform {
    return new Transform({
        objectMode: true,

        transform(row: Book, _encoding, callback) {
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
                    callback(new Error(`Author ID not found for: "${author}"`));
                    return;
                }

                this.push({
                    isbn: row.ISBN13,
                    author_id: authorId,
                });
            }

            callback();
        },
    });
}

// Normalizes data into borrowers.csv
async function normalizeBorrowers(
    inputPath = PATHS.input.borrowers,
    outputPath = PATHS.output.borrowers,
) {
    await processCsvFile(inputPath, outputPath, mapBorrower);
    console.log("borrowers.csv finished");
}

// Normalizes data into books.csv
async function normalizeBooks(inputPath = PATHS.input.books, outputPath = PATHS.output.books) {
    await processCsvFile(inputPath, outputPath, mapBook);
    console.log("books.csv finished");
}

// Normalizes data into authors.csv
async function normalizeAuthors(inputPath = PATHS.input.books, outputPath = PATHS.output.authors) {
    // Reset the shared map in case this function is run again.
    authorIds.clear();

    await processCsvFile(inputPath, outputPath, createAuthorsTransform());
    console.log("authors.csv finished");
}

// Normalizes data into book_authors.csv
async function normalizeBookAuthors(
    inputPath = PATHS.input.books,
    outputPath = PATHS.output.bookAuthors,
) {
    await processCsvFile(inputPath, outputPath, createBookAuthorsTransform());
    console.log("book_authors.csv finished");
}

// Run all normalization functions in the correct order.
async function main() {
    await normalizeBorrowers();
    await normalizeBooks();

    // Must run before normalizeBook_Authors.
    await normalizeAuthors();
    await normalizeBookAuthors();

    console.log("All Files Complete!");
}

await main();
