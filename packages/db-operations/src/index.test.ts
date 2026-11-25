import type { Database } from "@cs-4347/db-schema";
import { afterEach, describe, expect, it } from "@rstest/core";
import type { Kysely } from "kysely";
import {
    createDatabase,
    DEFAULT_SQLITE_PATH,
    ensureDatabaseSchema,
    resolveSqlitePath,
} from "./index";

describe("resolveSqlitePath", () => {
    it("defaults to ./data/library.sqlite when DB_PATH is unset", () => {
        expect(resolveSqlitePath(undefined, {})).toBe(DEFAULT_SQLITE_PATH);
    });

    it("prefers explicit path, then DB_PATH env var", () => {
        expect(resolveSqlitePath(":memory:", { DB_PATH: "./other.sqlite" })).toBe(":memory:");
        expect(resolveSqlitePath(undefined, { DB_PATH: "./custom.sqlite" })).toBe(
            "./custom.sqlite",
        );
    });
});

describe("createDatabase & ensureDatabaseSchema", () => {
    let db: Kysely<Database> | undefined;

    afterEach(async () => {
        await db?.destroy();
        db = undefined;
    });

    it("creates schema tables and queries via Kysely", async () => {
        db = createDatabase(":memory:");
        await ensureDatabaseSchema(db);

        await db
            .insertInto("books")
            .values({ isbn: "9780195153445", title: "Classical Mythology" })
            .execute();
        await db
            .insertInto("authors")
            .values({ author_id: 0, name: "Mark P. O. Morford" })
            .execute();
        await db
            .insertInto("book_authors")
            .values({ isbn: "9780195153445", author_id: 0 })
            .execute();

        const books = await db.selectFrom("books").selectAll().execute();
        expect(books).toEqual([{ isbn: "9780195153445", title: "Classical Mythology" }]);
    });
});
