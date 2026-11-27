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

    it("returns an empty list when no search query is provided", async () => {
        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });

        expect(await controller.search()).toEqual([]);
        expect(await controller.search("   ")).toEqual([]);
    });

    it("delegates GET /api/books?q=... to BooksService.search()", async () => {
        await db.insert(books).values([
            { isbn: "0891787631", title: "College Algebra" },
            { isbn: "T619875682", title: "Wills and Trusts for Retirement" },
        ]);
        await db.insert(authors).values([
            { author_id: 1, name: "Will McDaniels" },
            { author_id: 2, name: "Barbara Brown" },
        ]);
        await db.insert(bookAuthors).values([
            { author_id: 1, isbn: "0891787631" },
            { author_id: 2, isbn: "T619875682" },
        ]);
        await db.insert(borrowers).values({
            card_id: "ID000001",
            ssn: "111-11-1111",
            bname: "Alice Reader",
            address: "100 Main St, Dallas, TX",
        });
        await db.insert(bookLoans).values({
            isbn: "T619875682",
            card_id: "ID000001",
            date_out: "2026-11-01",
            due_date: "2026-11-15",
            date_in: null,
        });

        const results = await controller.search("will");

        expect(results).toHaveLength(2);
        expect(results).toEqual(
            expect.arrayContaining([
                {
                    isbn: "0891787631",
                    title: "College Algebra",
                    authors: "Will McDaniels",
                    status: "IN",
                },
                {
                    isbn: "T619875682",
                    title: "Wills and Trusts for Retirement",
                    authors: "Barbara Brown",
                    status: "OUT",
                },
            ]),
        );
    });
});
