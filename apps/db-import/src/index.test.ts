import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "@cs-4347/database";
import type { Database } from "@cs-4347/db-schema";
import type { Kysely } from "kysely";
import { importAll, type PATHS } from "./index";

describe("importAll", () => {
    let tempDir: string;
    let db: Kysely<Database>;
    let paths: typeof PATHS;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "cs4347-db-import-"));
        db = createDatabase(":memory:");
        paths = {
            borrowers: join(tempDir, "borrowers.csv"),
            books: join(tempDir, "books.csv"),
            authors: join(tempDir, "authors.csv"),
            bookAuthors: join(tempDir, "book_authors.csv"),
        };

        await writeFile(
            paths.borrowers,
            [
                "card_id,ssn,bname,address,phone",
                'ID000001,850-47-3740,Mark Morgan,"5677 Coolidge Street, Plano, TX",(469) 904-1438',
            ].join("\n"),
        );

        await writeFile(
            paths.books,
            [
                "isbn,title",
                "9780195153445,Classical Mythology",
                "9780002005012,Clara Callan: A Novel",
            ].join("\n"),
        );

        await writeFile(
            paths.authors,
            [
                "author_id,name",
                "0,Mark P. O. Morford",
                "1,Robert J. Lenardon",
                "2,Richard Bruce Wright",
            ].join("\n"),
        );

        await writeFile(
            paths.bookAuthors,
            ["isbn,author_id", "9780195153445,0", "9780195153445,1", "9780002005012,2"].join("\n"),
        );
    });

    afterEach(async () => {
        await db.destroy();
        await rm(tempDir, { recursive: true, force: true });
    });

    it("imports normalized CSVs into SQLite via Kysely", async () => {
        const summary = await importAll(db, paths);

        expect(summary).toEqual({
            borrowers: 1,
            books: 2,
            authors: 3,
            bookAuthors: 3,
        });

        const books = await db.selectFrom("books").selectAll().orderBy("isbn", "asc").execute();
        expect(books).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
        ]);

        const bookAuthors = await db
            .selectFrom("book_authors")
            .innerJoin("authors", "authors.author_id", "book_authors.author_id")
            .select(["book_authors.isbn", "authors.name"])
            .where("book_authors.isbn", "=", "9780195153445")
            .orderBy("authors.author_id", "asc")
            .execute();

        expect(bookAuthors).toEqual([
            { isbn: "9780195153445", name: "Mark P. O. Morford" },
            { isbn: "9780195153445", name: "Robert J. Lenardon" },
        ]);
    });

    it("replaces existing rows on re-import", async () => {
        await importAll(db, paths);
        const secondRun = await importAll(db, paths);

        expect(secondRun).toEqual({
            borrowers: 1,
            books: 2,
            authors: 3,
            bookAuthors: 3,
        });
    });

    it("throws a helpful error when normalized CSV files are missing", async () => {
        await expect(
            importAll(db, { ...paths, books: join(tempDir, "missing.csv") }),
        ).rejects.toThrow("Normalized CSV file not found");
    });
});
