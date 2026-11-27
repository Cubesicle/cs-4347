import { type AppDatabase, bookLoans, books, borrowers, createDatabase, fines } from "@cs-4347/db";
import { HttpException } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { FinesService } from "./fines.service";

async function expectClientError(promise: Promise<unknown>): Promise<HttpException> {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBeGreaterThanOrEqual(400);
        expect(httpError.getStatus()).toBeLessThan(500);
        return httpError;
    }
    throw new Error("Expected promise to reject with a 4xx HttpException, but it resolved.");
}

describe("FinesService", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let service: FinesService;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            providers: [FinesService],
        }).compile();

        service = moduleRef.get(FinesService);

        await db.insert(books).values([
            { isbn: "1000000001", title: "Book One" },
            { isbn: "1000000002", title: "Book Two" },
            { isbn: "1000000003", title: "Book Three" },
            { isbn: "1000000004", title: "Book Four" },
        ]);
        await db.insert(borrowers).values([
            {
                card_id: "ID000001",
                ssn: "111-11-1111",
                bname: "Alice Johnson",
                address: "100 First St, Dallas, TX",
            },
            {
                card_id: "ID000002",
                ssn: "222-22-2222",
                bname: "Bob Williams",
                address: "200 Second St, Plano, TX",
            },
        ]);
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined with an injected database", () => {
        expect(db).toBeDefined();
        expect(service).toBeDefined();
    });

    describe("refreshFines", () => {
        it("does not create fines for on-time returned loans or not-yet-due active loans", async () => {
            await db.insert(bookLoans).values([
                {
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-11-01",
                    due_date: "2026-11-15",
                    date_in: "2026-11-15",
                },
                {
                    isbn: "1000000002",
                    card_id: "ID000001",
                    date_out: "2026-11-05",
                    due_date: "2026-11-19",
                    date_in: null,
                },
            ]);

            const summary = await service.refreshFines("2026-11-19");

            expect(summary).toEqual({ inserted: 0, updated: 0, unchanged: 0 });
            expect(await db.select().from(fines)).toEqual([]);
        });

        it("calculates (date_in - due_date) * $0.25 for late returned books", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
                date_in: "2026-11-20", // 5 days late -> $1.25
            });

            const summary = await service.refreshFines("2026-11-25");

            expect(summary).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
            const rows = await db.select().from(fines);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.loan_id).toBe(1);
            expect(Number(rows[0]?.fine_amt).toFixed(2)).toBe("1.25");
            expect(rows[0]?.paid).toBe(false);
        });

        it("calculates estimated (today - due_date) * $0.25 for overdue unreturned books", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
                date_in: null, // 6 days overdue on 2026-11-21 -> $1.50
            });

            const summary = await service.refreshFines("2026-11-21");

            expect(summary).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
            const rows = await db.select().from(fines);
            expect(rows).toHaveLength(1);
            expect(Number(rows[0]?.fine_amt).toFixed(2)).toBe("1.50");
            expect(rows[0]?.paid).toBe(false);
        });

        it("updates an existing unpaid fine without duplicating when the amount changes", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
                date_in: null,
            });

            await service.refreshFines("2026-11-17"); // 2 days -> $0.50
            const secondRun = await service.refreshFines("2026-11-20"); // 5 days -> $1.25

            expect(secondRun).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
            const rows = await db.select().from(fines);
            expect(rows).toHaveLength(1);
            expect(Number(rows[0]?.fine_amt).toFixed(2)).toBe("1.25");
        });

        it("leaves an existing unpaid fine unchanged when the amount is identical", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
                date_in: null, // 6 days -> $1.50 (reads back from SQLite NUMERIC as "1.5")
            });

            await service.refreshFines("2026-11-21");
            const secondRun = await service.refreshFines("2026-11-21");

            expect(secondRun).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
        });

        it("does nothing when an existing fine row has paid = true", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-01",
                due_date: "2026-11-15",
                date_in: "2026-11-20",
            });
            await db.insert(fines).values({
                loan_id: 1,
                fine_amt: "0.75",
                paid: true,
            });

            const summary = await service.refreshFines("2026-11-25");

            expect(summary).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
            const [row] = await db.select().from(fines).where(eq(fines.loan_id, 1));
            expect(Number(row?.fine_amt).toFixed(2)).toBe("0.75");
            expect(row?.paid).toBe(true);
        });
    });

    describe("listFines & payFines", () => {
        beforeEach(async () => {
            await db.insert(bookLoans).values([
                {
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-10-01",
                    due_date: "2026-10-15",
                    date_in: "2026-10-20", // 5 days late -> $1.25 (returned)
                },
                {
                    isbn: "1000000002",
                    card_id: "ID000001",
                    date_out: "2026-10-05",
                    due_date: "2026-10-19",
                    date_in: "2026-10-22", // 3 days late -> $0.75 (returned)
                },
                {
                    isbn: "1000000003",
                    card_id: "ID000002",
                    date_out: "2026-10-01",
                    due_date: "2026-10-15",
                    date_in: "2026-10-17", // 2 days late -> $0.50 (paid)
                },
                {
                    isbn: "1000000004",
                    card_id: "ID000002",
                    date_out: "2026-11-01",
                    due_date: "2026-11-15",
                    date_in: null, // unreturned -> $1.00
                },
            ]);

            await db.insert(fines).values([
                { loan_id: 1, fine_amt: "1.25", paid: false },
                { loan_id: 2, fine_amt: "0.75", paid: false },
                { loan_id: 3, fine_amt: "0.50", paid: true },
                { loan_id: 4, fine_amt: "1.00", paid: false },
            ]);
        });

        it("groups and sums fines by card_id formatted to two decimal places", async () => {
            const unpaid = await service.listFines();

            expect(unpaid).toEqual(
                expect.arrayContaining([
                    {
                        card_id: "ID000001",
                        bname: "Alice Johnson",
                        total_fine: "2.00",
                        has_unreturned_books: false,
                    },
                    {
                        card_id: "ID000002",
                        bname: "Bob Williams",
                        total_fine: "1.00",
                        has_unreturned_books: true,
                    },
                ]),
            );
            expect(unpaid).toHaveLength(2);
        });

        it("filters out paid fines by default and includes them when includePaid is true", async () => {
            const unpaidOnly = await service.listFines({ includePaid: false });
            const bobUnpaid = unpaidOnly.find((f) => f.card_id === "ID000002");
            expect(bobUnpaid?.total_fine).toBe("1.00");

            const allFines = await service.listFines({ includePaid: true });
            const bobAll = allFines.find((f) => f.card_id === "ID000002");
            expect(bobAll?.total_fine).toBe("1.50");
        });

        it("blocks payment if any unpaid fine belongs to an unreturned book", async () => {
            await expectClientError(service.payFines("ID000002"));

            const [fine4] = await db.select().from(fines).where(eq(fines.loan_id, 4));
            expect(fine4?.paid).toBe(false);
        });

        it("clears all unpaid fines for a borrower in full once all books are returned", async () => {
            const result = await service.payFines("ID000001");

            expect(result).toEqual({
                card_id: "ID000001",
                cleared_count: 2,
                total_paid: "2.00",
            });

            const aliceFines = await db.select().from(fines).where(eq(fines.paid, true));
            expect(aliceFines.map((f) => f.loan_id)).toEqual(expect.arrayContaining([1, 2]));

            const remainingUnpaid = await service.listFines();
            expect(remainingUnpaid.find((f) => f.card_id === "ID000001")).toBeUndefined();
        });

        it("rejects payment when the borrower has no unpaid fines", async () => {
            await service.payFines("ID000001");

            await expectClientError(service.payFines("ID000001"));
            await expectClientError(service.payFines("ID999999"));
        });
    });
});
