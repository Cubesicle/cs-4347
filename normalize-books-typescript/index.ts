import { Readable } from "node:stream";
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

//maps author name to their id
const authorIds = new Map<string, number>();

//Normalizes data into borrowers.csv
async function normalizeBorrowers() {
    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const borrowersReader = Bun.file("./borrowers.csv").stream();
    const borrowersWriter = (() => {
        const path = "./normalized/borrowers.csv";
        Bun.write(path, ""); // Create the file first
        return Bun.file(path).writer();
    })();

    const pipeline = Readable.from(borrowersReader)
        .pipe(parser) // Run it through the CSV parser
        .pipe(
            // Make it match the schema (we use snake_case for column names, not whatever bs naming convention is used in the pdf)
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

//Normalizes data into books.csv
async function normalizeBooks() {

    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();
    const booksWriter = (() => {
        const path = "./normalized/books.csv";
        Bun.write(path, ""); // Create the file first
        return Bun.file(path).writer();
    })();

    const pipeline = Readable.from(booksReader)
        .pipe(parser) // Run it through the CSV parser
        .pipe(
            // Make it match the schema (we use snake_case for column names, not whatever bs naming convention is used in the pdf)
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

//Normalizes data into authors.csv
async function normalizeAuthors() {

    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();
    const booksWriter = (() => {
        const path = "./normalized/authors.csv";
        Bun.write(path, ""); // Create the file first
        return Bun.file(path).writer();
    })();

    let nextAuthorId = 1;

    const pipeline = Readable.from(booksReader)
        .pipe(parser) // Run it through the CSV parser
        .pipe(
            // Make it match the schema (we use snake_case for column names, not whatever bs naming convention is used in the pdf)
            transform((row: Book) => {
                //check if it's a unique author, if it is, then add them to the authors that have been seen and csv
                if (!authorIds.has(row.Author)) {
                    authorIds.set(row.Author, nextAuthorId++);

                    return {
                        Author_id: authorIds.get(row.Author),
                        Name: row.Author,
                    };
                }
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

    console.log("authors.csv finished");
}

//Normalizes data into book_authors.csv
async function normalizeBook_Authors() {

    const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const booksReader = Bun.file("./books.csv").stream();
    const booksWriter = (() => {
        const path = "./normalized/book_authors.csv";
        Bun.write(path, ""); // Create the file first
        return Bun.file(path).writer();
    })();


    const pipeline = Readable.from(booksReader)
        .pipe(parser) // Run it through the CSV parser
        .pipe(
            // Make it match the schema (we use snake_case for column names, not whatever bs naming convention is used in the pdf)
            transform((row: Book) => {

                return {
                    Isbn: row.ISBN13,
                    Author_id: authorIds.get(row.Author),
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

    console.log("book_authors.csv finished");
}


//run all the functions
await Promise.all([
    normalizeBorrowers(),
    normalizeBooks(),
    normalizeAuthors(),
]);

//Must wait for normalizeAuthors to complete
await normalizeBook_Authors();

console.log("All Files Complete!")
