import { afterEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
    type AppDatabase,
    authors,
    bookAuthors,
    bookLoans,
    books,
    borrowers,
    createDatabase,
    DEFAULT_SQLITE_PATH,
    fines,
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

    it("creates all six library tables and enforces relationships", async () => {
        db = createDatabase(":memory:");

        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });
        await db.insert(authors).values({ author_id: 0, name: "Mark P. O. Morford" });
        await db.insert(bookAuthors).values({ author_id: 0, isbn: "9780195153445" });
        await db.insert(borrowers).values({
            card_id: "ID000001",
            ssn: "850-47-3740",
            bname: "Mark Morgan",
            address: "5677 Coolidge Street, Plano, TX",
            phone: null,
        });

        const [loan] = await db
            .insert(bookLoans)
            .values({
                isbn: "9780195153445",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
            })
            .returning();

        expect(loan).toEqual({
            loan_id: 1,
            isbn: "9780195153445",
            card_id: "ID000001",
            date_out: "2026-11-01",
            due_date: "2026-11-15",
            date_in: null,
        });

        await db.insert(fines).values({
            loan_id: 1,
            fine_amt: "1.25",
        });

        const fineRows = await db.select().from(fines);
        expect(fineRows).toEqual([{ loan_id: 1, fine_amt: "1.25", paid: false }]);
    });

    it("enforces unique borrower SSNs", async () => {
        db = createDatabase(":memory:");

        await db.insert(borrowers).values({
            card_id: "ID000001",
            ssn: "111-11-1111",
            bname: "Jane Doe",
            address: "123 Main St, Richardson, TX",
        });

        expect(() =>
            db
                ?.insert(borrowers)
                .values({
                    card_id: "ID000002",
                    ssn: "111-11-1111",
                    bname: "Jane Duplicate",
                    address: "456 Oak Ave, Plano, TX",
                })
                .run(),
        ).toThrow();
    });

    it("prevents checking out an already checked-out book, then allows re-checkout after check-in", async () => {
        db = createDatabase(":memory:");

        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });
        await db.insert(borrowers).values([
            {
                card_id: "ID000001",
                ssn: "111-11-1111",
                bname: "Alice",
                address: "100 First St, Dallas, TX",
            },
            {
                card_id: "ID000002",
                ssn: "222-22-2222",
                bname: "Bob",
                address: "200 Second St, Dallas, TX",
            },
        ]);

        await db.insert(bookLoans).values({
            isbn: "9780195153445",
            card_id: "ID000001",
            date_out: "2026-11-01",
            due_date: "2026-11-15",
        });

        expect(() =>
            db
                ?.insert(bookLoans)
                .values({
                    isbn: "9780195153445",
                    card_id: "ID000002",
                    date_out: "2026-11-02",
                    due_date: "2026-11-16",
                })
                .run(),
        ).toThrow();

        await db.update(bookLoans).set({ date_in: "2026-11-05" }).where(eq(bookLoans.loan_id, 1));

        const [secondLoan] = await db
            .insert(bookLoans)
            .values({
                isbn: "9780195153445",
                card_id: "ID000002",
                date_out: "2026-11-06",
                due_date: "2026-11-20",
            })
            .returning();

        expect(secondLoan?.loan_id).toBe(2);
    });

    it("rejects negative fine amounts", async () => {
        db = createDatabase(":memory:");

        await db.insert(books).values({ isbn: "9780195153445", title: "Classical Mythology" });
        await db.insert(borrowers).values({
            card_id: "ID000001",
            ssn: "111-11-1111",
            bname: "Alice",
            address: "100 First St, Dallas, TX",
        });
        await db.insert(bookLoans).values({
            isbn: "9780195153445",
            card_id: "ID000001",
            date_out: "2026-11-01",
            due_date: "2026-11-15",
        });

        expect(() => db?.insert(fines).values({ loan_id: 1, fine_amt: "-0.25" }).run()).toThrow();
    });
});
