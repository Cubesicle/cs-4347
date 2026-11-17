import { createDatabase, ensureDatabaseSchema } from "@cs-4347/database";
import type { Database } from "@cs-4347/db-schema";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Kysely } from "kysely";
import { DATABASE_TOKEN } from "../database/database.module";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

describe("BooksController", () => {
    let db: Kysely<Database>;
    let controller: BooksController;

    beforeEach(async () => {
        db = createDatabase(":memory:");
        await ensureDatabaseSchema(db);

        const moduleRef = await Test.createTestingModule({
            controllers: [BooksController],
            providers: [
                BooksService,
                {
                    provide: DATABASE_TOKEN,
                    useValue: db,
                },
            ],
        }).compile();

        controller = moduleRef.get(BooksController);
    });

    afterEach(async () => {
        await db.destroy();
    });

    it("returns all books from the books table", async () => {
        await db
            .insertInto("books")
            .values([
                { isbn: "9780195153445", title: "Classical Mythology" },
                { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            ])
            .execute();

        const result = await controller.findAll();
        expect(result).toEqual([
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
            { isbn: "9780195153445", title: "Classical Mythology" },
        ]);
    });

    it("returns a single book by ISBN", async () => {
        await db
            .insertInto("books")
            .values({ isbn: "9780195153445", title: "Classical Mythology" })
            .execute();

        expect(await controller.findOne("9780195153445")).toEqual({
            isbn: "9780195153445",
            title: "Classical Mythology",
        });
    });

    it("throws NotFoundException when ISBN does not exist", async () => {
        await expect(controller.findOne("missing-isbn")).rejects.toThrow(NotFoundException);
    });
});
