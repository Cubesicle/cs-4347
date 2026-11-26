import { afterEach, describe, expect, it } from "bun:test";
import {
    type AppDatabase,
    authors,
    bookAuthors,
    books,
    createDatabase,
    DEFAULT_SQLITE_PATH,
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
    let db: AppDatabase | undefined;

    afterEach(() => {
        db?.$client.close();
        db = undefined;
    });

    it("creates schema tables and queries via Drizzle", async () => {
        db = createDatabase(":memory:");

        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });
        await db.insert(authors).values({ author_id: 0, name: "Mark P. O. Morford" });
        await db.insert(bookAuthors).values({ isbn: "9780195153445", author_id: 0 });

        const rows = await db.select().from(books);
        expect(rows).toEqual([{ isbn: "9780195153445", title: "Classical Mythology" }]);
    });
});
