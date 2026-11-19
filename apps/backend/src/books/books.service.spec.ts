import { createDatabase, ensureDatabaseSchema } from "@cs-4347/db-operations";
import type { Database } from "@cs-4347/db-schema";
import { Test } from "@nestjs/testing";
import type { Kysely } from "kysely";
import { DATABASE_TOKEN } from "../database/database.module";
import { BooksService } from "./books.service";

describe("BooksService", () => {
    let db: Kysely<Database>;
    let service: BooksService;

    beforeEach(async () => {
        db = createDatabase(":memory:");
        await ensureDatabaseSchema(db);

        const moduleRef = await Test.createTestingModule({
            providers: [
                BooksService,
                {
                    provide: DATABASE_TOKEN,
                    useValue: db,
                },
            ],
        }).compile();

        service = moduleRef.get(BooksService);
    });

    afterEach(async () => {
        await db.destroy();
    });

    it("returns an empty list when the books table has no rows", async () => {
        expect(await service.findAll()).toEqual([]);
    });

    it("returns all books ordered by title and isbn", async () => {
        await db
            .insertInto("books")
            .values([
                { isbn: "9780195153446", title: "Classical Mythology" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
                { isbn: "9780195153445", title: "Classical Mythology" },
            ])
            .execute();

        expect(await service.findAll()).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
            { isbn: "9780195153446", title: "Classical Mythology" },
        ]);
    });

    it("finds a book by ISBN and returns undefined when absent", async () => {
        await db
            .insertInto("books")
            .values({ isbn: "9780060973124", title: "Decision In Normandy" })
            .execute();

        expect(await service.findByIsbn("9780060973124")).toEqual({
            isbn: "9780060973124",
            title: "Decision In Normandy",
        });
        expect(await service.findByIsbn("0000000000000")).toBeUndefined();
    });
});
