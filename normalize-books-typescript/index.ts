import { Readable } from "node:stream";
import { parse } from "csv";

const booksFile = Bun.file("books.csv");
Readable.from(booksFile.stream())
    .pipe(parse())
    .on("data", (row) => {
        console.log(`Parsed row: ${row}`);
    })
    .on("end", () => {
        console.log("Done!");
    });
