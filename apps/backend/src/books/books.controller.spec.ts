import { type AppDatabase, books, createDatabase } from "@cs-4347/db";
import { NotFoundException } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

describe("BooksController", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let controller: BooksController;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            controllers: [BooksController],
            providers: [BooksService],
        }).compile();

        controller = moduleRef.get(BooksController);
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("returns all books from the books table", async () => {
        await db.insert(books).values([
            { isbn: "9780195153445", title: "Classical Mythology" },
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
        ]);

        const result = await controller.findAll();
        expect(result).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
        ]);
    });

    it("returns a single book by ISBN", async () => {
        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });

        expect(await controller.findOne("9780195153445")).toEqual({
            isbn: "9780195153445",
            title: "Classical Mythology",
        });
    });

    it("throws NotFoundException when ISBN does not exist", async () => {
        await expect(controller.findOne("missing-isbn")).rejects.toThrow(NotFoundException);
    });

    describe("search query", () => {
        it.todo("delegates GET /api/books?q=... to BooksService.search()");
    });
});
