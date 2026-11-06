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
        // Make it match the schema
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
        }),
    );

for await (const chunk of pipeline) {
    borrowersWriter.write(chunk);
}

borrowersWriter.end();

console.log("Normalization finished");
