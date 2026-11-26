import { type AppDatabase, books, createDatabase } from "@cs-4347/db";
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
        it.todo("matches case-insensitive substrings across ISBN, title, and author names");
        it.todo("returns all authors as a comma-separated string in a single row per book");
        it.todo("returns at most one result when searching by full ISBN");
        it.todo("reports status IN when available or returned, and OUT when actively checked out");
    });
});
