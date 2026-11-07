import { Readable, Transform } from "node:stream";
import { parse, stringify, transform } from "csv";
import { titleCase } from "title-case";

// File paths configuration
const INPUT_DIR = "./data-original";
const OUTPUT_DIR = "./data-normalized";

export const PATHS = {
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

export interface Borrower {
    ID0000id: string;
    ssn: string;
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
}

export interface Book {
    ISBN10: string;
    ISBN13: string;
    Title: string;
    Author: string;
    Publisher: string;
    Pages: number;
}

// Maps normalized author names to their IDs.
const authorIds = new Map<string, number>();

// Normalizes and title-cases a single author name.
export function normalizeAuthorName(name: string): string {
    const cleaned = name
        // Decompose accented characters and strip combining diacritical marks (\u0300-\u036F).
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        // Strip zero-width spaces/joiners (\u200B-\u200D), BOM (\uFEFF), and soft hyphens (\u00AD).
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
        // Collapse multiple spaces/tabs into a single space.
        .replace(/\s+/g, " ")
        // Strip outer quotes and boundary punctuation, preserving periods for initials/titles.
        .replace(/^[\s"'`´,;:/-]+|[\s"'`´,;:/-]+$/g, "")
        // Strip dangling boundary conjunctions (e.g. "And Lamb" -> "Lamb").
        .replace(/^(?:and|&)\s+|\s+(?:and|&)$/i, "")
        .trim();

    // Discard any token that contains no Unicode letters (\p{L}) or digits (\p{N}).
    if (!cleaned || !/\p{L}|\p{N}/u.test(cleaned)) {
        return "";
    }

    // Lowercase only if all letters are uppercase (\p{Lu}) to title-case all-caps names while
    // preserving proper casing for Celtic/Italian surnames and initials (e.g. "McCaffrey", "J.K.").
    const isAllUpper = cleaned === cleaned.toUpperCase() && /\p{Lu}/u.test(cleaned);
    return titleCase(isAllUpper ? cleaned.toLowerCase() : cleaned).trim();
}

// Inverts "LastName, FirstName" in semicolon-separated parts into "FirstName LastName".
export function parseSemicolonPart(part: string): string {
    const trimmed = part.trim();
    const [last, first, ...extra] = trimmed.split(",").map((s) => s.trim());
    return first && last && extra.length === 0 ? `${first} ${last}` : trimmed;
}

export function formatAuthors(authorEntry: string): string[] {
    if (!authorEntry?.trim()) {
        return [];
    }

    const cleaned = authorEntry
        .replace(/"/g, "")
        // Strip parenthetical annotations and truncated/unclosed opening parentheses (e.g. "(editor)", "(Co").
        .replace(/\([^)]*(?:\)|$)/g, "")
        .replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "")
        .trim();

    if (!cleaned) {
        return [];
    }

    const rawParts = cleaned.includes(";")
        ? cleaned.split(";").map(parseSemicolonPart)
        : cleaned.split(",");

    const seen = new Set<string>();
    const authors: string[] = [];

    for (const raw of rawParts) {
        // Split co-authors separated by "and" or "&" surrounded by whitespace.
        for (const sub of raw.split(/\s+(?:&|and)\s+/i)) {
            const normalized = normalizeAuthorName(sub);
            if (normalized && !seen.has(normalized)) {
                seen.add(normalized);
                authors.push(normalized);
            }
        }
    }

    return authors;
}

export function createCsvParser() {
    return parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
}

export function createCsvStringifier() {
    return stringify({
        header: true,
        quoted: false,
    });
}

// Streams a CSV file from inputPath, transforms rows using the given transformer,
// and writes the result to outputPath as a CSV file.
export async function processCsvFile<TInput = unknown, TOutput = unknown>(
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

export function mapBorrower(row: Borrower) {
    return {
        card_id: row.ID0000id,
        ssn: row.ssn,
        bname: `${row.first_name} ${row.last_name}`,
        address: [row.address, row.city, row.state].join(", "),
        phone: row.phone,
    };
}

export function mapBook(row: Book) {
    return {
        isbn: row.ISBN13,
        title: row.Title,
    };
}

export function createAuthorsTransform(): Transform {
    let nextAuthorId = 0;

    return new Transform({
        objectMode: true,

        transform(row: Book, _encoding, callback) {
            for (const author of formatAuthors(row.Author)) {
                if (authorIds.has(author)) {
                    continue;
                }

                const authorId = nextAuthorId++;
                authorIds.set(author, authorId);

                this.push({
                    author_id: authorId,
                    name: author,
                });
            }

            callback();
        },
    });
}

export function createBookAuthorsTransform(): Transform {
    return new Transform({
        objectMode: true,

        transform(row: Book, _encoding, callback) {
            for (const author of formatAuthors(row.Author)) {
                const authorId = authorIds.get(author);

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
export async function normalizeBorrowers(
    inputPath = PATHS.input.borrowers,
    outputPath = PATHS.output.borrowers,
) {
    await processCsvFile(inputPath, outputPath, mapBorrower);
    console.log("borrowers.csv finished");
}

// Normalizes data into books.csv
export async function normalizeBooks(
    inputPath = PATHS.input.books,
    outputPath = PATHS.output.books,
) {
    await processCsvFile(inputPath, outputPath, mapBook);
    console.log("books.csv finished");
}

// Normalizes data into authors.csv
export async function normalizeAuthors(
    inputPath = PATHS.input.books,
    outputPath = PATHS.output.authors,
) {
    // Reset the shared map in case this function is run again.
    authorIds.clear();

    await processCsvFile(inputPath, outputPath, createAuthorsTransform());
    console.log("authors.csv finished");
}

// Normalizes data into book_authors.csv
export async function normalizeBookAuthors(
    inputPath = PATHS.input.books,
    outputPath = PATHS.output.bookAuthors,
) {
    await processCsvFile(inputPath, outputPath, createBookAuthorsTransform());
    console.log("book_authors.csv finished");
}

// Run all normalization functions in the correct order.
export async function main() {
    await normalizeBorrowers();
    await normalizeBooks();

    // Must run before normalizeBookAuthors.
    await normalizeAuthors();
    await normalizeBookAuthors();

    console.log("All Files Complete!");
}

if (import.meta.main) {
    await main();
}
