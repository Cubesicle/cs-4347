import { type AppDatabase, books, bookLoans, authors, bookAuthors, createDatabase, borrowers } from "@cs-4347/db";
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
        expect(await service.search("")).toEqual([]);
    });

    it("returns all books ordered by title and isbn", async () => {
        await db.insert(books).values([
            { isbn: "9780195153446", title: "Classical Mythology" },
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
        ]);

        expect(await service.search("")).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel", authors: "", status: "IN" },
            { isbn: "9780195153445", title: "Classical Mythology", authors: "", status: "IN" },
            { isbn: "9780195153446", title: "Classical Mythology", authors: "", status: "IN" },
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
        
        it("matches case-insensitive substrings across ISBN, title and author names", async () => {
            await db.insert(books).values([
                { isbn:"9780131103627", title: "The C Programming Language" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
                { isbn: "9780195153445", title: "Classical Mythology" },
            ]);
            await db.insert(authors).values([
                { author_id: 1, name: "John Doe" },
                { author_id: 2, name: "John Jones" },
                { author_id: 3, name: "Jane Doe" },
            ]);
            await db.insert(bookAuthors).values([
                { author_id: 1, isbn: "9780131103627" },
                { author_id: 2, isbn: "9780002005012" },
                { author_id: 3, isbn: "9780195153445" },
            ]);
            const isbn_partial = await service.search("978013");
            const title_partial = await service.search("CLASSical My");
            const author_partial = await service.search(" JOH  ");
            expect(isbn_partial).toEqual([
                { isbn: "9780131103627", title: "The C Programming Language", authors: "John Doe", status: "IN"},
            ]);
            expect(title_partial).toEqual([
                { isbn: "9780195153445", title: "Classical Mythology", authors: "Jane Doe", status: "IN" },
            ]);
            expect(author_partial).toEqual([
                { isbn: "9780002005012", title: "Clara Callan: A Novel", authors: "John Jones", status: "IN" },
                { isbn: "9780131103627", title: "The C Programming Language", authors: "John Doe", status: "IN" },
            ]);
        });
        
        it("returns all authors as one string with one row per book", async () => {
            await db.insert(books).values([
                { isbn: "9780195153446", title: "Classical Mythology" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            ]);
            await db.insert(authors).values([
                { author_id: 1, name: "John Doe" },
                { author_id: 2, name: "John Jones" },
                { author_id: 3, name: "Jane Doe" },
                { author_id: 4, name: "Jane Art" },
            ]);
            await db.insert(bookAuthors).values([
                { author_id: 1, isbn: "9780195153446" },
                { author_id: 2, isbn: "9780195153446" },
                { author_id: 3, isbn: "9780002005012" },
                { author_id: 4, isbn: "9780002005012" },
            ]);
            const single_rows = await service.search("Cla");
            expect(single_rows).toEqual([
                { isbn: "9780002005012", title: "Clara Callan: A Novel", authors: "Jane Art, Jane Doe", status: "IN" },
                { isbn: "9780195153446", title: "Classical Mythology", authors: "John Doe, John Jones", status: "IN" },
            ]);
        });
        
        it("returns one book for a full ISBN search", async () => {
            await db.insert(books).values([
                { isbn: "9780195153446", title: "Classical Mythology" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            ]);
            const full_isbn = await service.search("9780195153446");
            expect(full_isbn).toEqual([{ isbn: "9780195153446", title: "Classical Mythology", authors: "", status: "IN" },])
        });
        
        it("reports book availability status based on active loan", async () => {
            await db.insert(books).values([
                { isbn:"9780131103627", title: "The C Programming Language" },
                { isbn: "9780195153446", title: "Classical Mythology" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            ]);
            await db.insert(borrowers).values({card_id: "12345", ssn: "123456789", bname: "Jack Box", address: "City", phone: "1234"})
            await db.insert(bookLoans).values([
                { isbn: "9780002005012", card_id: "12345", date_out: "2026-11-01", due_date: "2026-11-15", date_in: null},
                { isbn: "9780195153446", card_id: "12345", date_out: "2026-11-01", due_date: "2026-11-15", date_in: "2026-11-15" },
            ]);
            const resultIn1 = await service.search("Programming");
            const resultIn2 = await service.search("Classical");
            const resultOut = await service.search("Clara");
            expect(resultIn1).toEqual([{isbn:"9780131103627", title:"The C Programming Language", authors:"", status:"IN",},]);
            expect(resultIn2).toEqual([{ isbn: "9780195153446", title: "Classical Mythology", authors: "", status: "IN", },]);
            expect(resultOut).toEqual([{ isbn: "9780002005012", title: "Clara Callan: A Novel", authors: "", status: "OUT",},]);
        });
    });
});
