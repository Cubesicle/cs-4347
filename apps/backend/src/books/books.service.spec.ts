import {
    type AppDatabase,
    authors,
    bookAuthors,
    bookLoans,
    books,
    borrowers,
    createDatabase,
} from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { BooksService } from "./books.service";

describe("BooksService", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let service: BooksService;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            providers: [BooksService],
        }).compile();

        service = moduleRef.get(BooksService);
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("returns an empty list when the books table has no rows", async () => {
        expect(await service.findAll()).toEqual([]);
    });

    it("returns all books ordered by title and isbn", async () => {
        await db.insert(books).values([
            { isbn: "9780195153446", title: "Classical Mythology" },
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
        ]);

        expect(await service.findAll()).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
            { isbn: "9780195153446", title: "Classical Mythology" },
        ]);
    });

    it("finds a book by ISBN and returns undefined when absent", async () => {
        await db.insert(books).values({ isbn: "9780060973124", title: "Decision In Normandy" });

        expect(await service.findByIsbn("9780060973124")).toEqual({
            isbn: "9780060973124",
            title: "Decision In Normandy",
        });
        expect(await service.findByIsbn("0000000000000")).toBeUndefined();
    });

    describe("search", () => {
        beforeEach(async () => {
            await db.insert(books).values([
                { isbn: "0923398364", title: "Houses of Williamsburg, Virginia" },
                { isbn: "0891787631", title: "College Algebra" },
                { isbn: "T619875682", title: "Wills and Trusts for Retirement" },
                { isbn: "X2723786q6", title: "The History of the Han Dynasty" },
                { isbn: "9999999999", title: "Database System Concepts" },
            ]);
            await db.insert(authors).values([
                { author_id: 1, name: "John Smith" },
                { author_id: 2, name: "Will McDaniels" },
                { author_id: 3, name: "Mary Jones" },
                { author_id: 4, name: "Barbara Brown, ESQ" },
                { author_id: 5, name: "Dawn Williamson" },
                { author_id: 6, name: "Abraham Silberschatz" },
            ]);
            await db.insert(bookAuthors).values([
                { author_id: 1, isbn: "0923398364" },
                { author_id: 2, isbn: "0891787631" },
                { author_id: 3, isbn: "0891787631" },
                { author_id: 4, isbn: "T619875682" },
                { author_id: 5, isbn: "X2723786q6" },
                { author_id: 6, isbn: "9999999999" },
            ]);
            await db.insert(borrowers).values({
                card_id: "ID000001",
                ssn: "111-11-1111",
                bname: "Alice Reader",
                address: "100 Main St, Dallas, TX",
            });
            await db.insert(bookLoans).values([
                {
                    isbn: "T619875682",
                    card_id: "ID000001",
                    date_out: "2026-11-01",
                    due_date: "2026-11-15",
                    date_in: null,
                },
                {
                    isbn: "0923398364",
                    card_id: "ID000001",
                    date_out: "2026-10-01",
                    due_date: "2026-10-15",
                    date_in: "2026-10-10",
                },
            ]);
        });

        it("matches case-insensitive substrings across ISBN, title, and author names", async () => {
            const results = await service.search("WiLl");
            const isbns = results.map((r) => r.isbn).sort();

            expect(isbns).toEqual(["0891787631", "0923398364", "T619875682", "X2723786q6"]);
        });

        it("returns all authors as a comma-separated string in a single row per book", async () => {
            const results = await service.search("mcdaniels");

            expect(results).toHaveLength(1);
            expect(results[0]?.isbn).toBe("0891787631");
            expect(results[0]?.title).toBe("College Algebra");
            expect(results[0]?.authors.split(", ").sort()).toEqual([
                "Mary Jones",
                "Will McDaniels",
            ]);
        });

        it("returns at most one result when searching by full ISBN", async () => {
            const results = await service.search("0891787631");

            expect(results).toHaveLength(1);
            expect(results[0]?.isbn).toBe("0891787631");
        });

        it("reports status IN when available or returned, and OUT when actively checked out", async () => {
            const results = await service.search("will");
            const statusByIsbn = new Map(results.map((r) => [r.isbn, r.status]));

            expect(statusByIsbn.get("0923398364")).toBe("IN");
            expect(statusByIsbn.get("0891787631")).toBe("IN");
            expect(statusByIsbn.get("T619875682")).toBe("OUT");
            expect(statusByIsbn.get("X2723786q6")).toBe("IN");
        });

        it("returns an empty array when no books match", async () => {
            expect(await service.search("nonexistent-query-xyz")).toEqual([]);
        });

        it("still returns matching books that have no author records", async () => {
            await db.insert(books).values({ isbn: "1111111111", title: "Anonymous Almanac" });

            const results = await service.search("almanac");

            expect(results).toEqual([
                {
                    isbn: "1111111111",
                    title: "Anonymous Almanac",
                    authors: "",
                    status: "IN",
                },
            ]);
        });
    });
});
