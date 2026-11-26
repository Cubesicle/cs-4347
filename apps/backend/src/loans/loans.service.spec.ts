import { type AppDatabase, bookLoans, books, borrowers, createDatabase, fines } from "@cs-4347/db";
import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { LoansService } from "./loans.service";

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

describe("LoansService", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let service: LoansService;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            providers: [LoansService],
        }).compile();

        service = moduleRef.get(LoansService);

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

    describe("checkout", () => {
        it("creates a loan with due_date set to exactly 14 calendar days from date_out", async () => {
            const loan = await service.checkout("1000000001", "ID000001", "2026-11-26");

            expect(loan).toEqual({
                loan_id: 1,
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-11-26",
                due_date: "2026-12-10",
                date_in: null,
            });
        });

        it("fails with NotFoundException when ISBN or card_id does not exist", async () => {
            await expect(
                service.checkout("missing-isbn", "ID000001", "2026-11-26"),
            ).rejects.toThrow(NotFoundException);
            await expect(service.checkout("1000000001", "ID999999", "2026-11-26")).rejects.toThrow(
                NotFoundException,
            );

            expect(await db.select().from(bookLoans)).toEqual([]);
        });

        it("fails when the book is already checked out by another or the same borrower", async () => {
            await service.checkout("1000000001", "ID000001", "2026-11-01");

            await expectClientError(service.checkout("1000000001", "ID000002", "2026-11-02"));
            await expectClientError(service.checkout("1000000001", "ID000001", "2026-11-02"));

            expect(await db.select().from(bookLoans)).toHaveLength(1);
        });

        it("fails when the borrower already has 3 active loans", async () => {
            await service.checkout("1000000001", "ID000001", "2026-11-01");
            await service.checkout("1000000002", "ID000001", "2026-11-01");
            await service.checkout("1000000003", "ID000001", "2026-11-01");

            await expectClientError(service.checkout("1000000004", "ID000001", "2026-11-02"));

            expect(await db.select().from(bookLoans)).toHaveLength(3);
        });

        it("allows checkout when a borrower has returned past loans and fewer than 3 active", async () => {
            await db.insert(bookLoans).values([
                {
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-09-01",
                    due_date: "2026-09-15",
                    date_in: "2026-09-10",
                },
                {
                    isbn: "1000000002",
                    card_id: "ID000001",
                    date_out: "2026-09-01",
                    due_date: "2026-09-15",
                    date_in: "2026-09-11",
                },
                {
                    isbn: "1000000003",
                    card_id: "ID000001",
                    date_out: "2026-09-01",
                    due_date: "2026-09-15",
                    date_in: "2026-09-12",
                },
            ]);

            const loan = await service.checkout("1000000004", "ID000001", "2026-11-01");
            expect(loan.isbn).toBe("1000000004");
            expect(loan.date_in).toBeNull();
        });

        it("fails when the borrower has any unpaid fine", async () => {
            const [pastLoan] = await db
                .insert(bookLoans)
                .values({
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-09-01",
                    due_date: "2026-09-15",
                    date_in: "2026-09-20",
                })
                .returning();

            await db.insert(fines).values({
                loan_id: pastLoan?.loan_id ?? 1,
                fine_amt: "1.25",
                paid: false,
            });

            await expectClientError(service.checkout("1000000002", "ID000001", "2026-11-01"));
            expect(await db.select().from(bookLoans)).toHaveLength(1);
        });

        it("allows checkout once all previous fines have been paid", async () => {
            const [pastLoan] = await db
                .insert(bookLoans)
                .values({
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-09-01",
                    due_date: "2026-09-15",
                    date_in: "2026-09-20",
                })
                .returning();

            await db.insert(fines).values({
                loan_id: pastLoan?.loan_id ?? 1,
                fine_amt: "1.25",
                paid: true,
            });

            const newLoan = await service.checkout("1000000002", "ID000001", "2026-11-01");
            expect(newLoan.isbn).toBe("1000000002");
        });
    });

    describe("searchActiveLoans & checkIn", () => {
        beforeEach(async () => {
            await db.insert(bookLoans).values([
                {
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-11-01",
                    due_date: "2026-11-15",
                    date_in: null,
                },
                {
                    isbn: "1000000002",
                    card_id: "ID000001",
                    date_out: "2026-11-02",
                    due_date: "2026-11-16",
                    date_in: null,
                },
                {
                    isbn: "1000000003",
                    card_id: "ID000001",
                    date_out: "2026-11-03",
                    due_date: "2026-11-17",
                    date_in: null,
                },
                {
                    isbn: "1000000004",
                    card_id: "ID000002",
                    date_out: "2026-10-01",
                    due_date: "2026-10-15",
                    date_in: "2026-10-10",
                },
            ]);
        });

        it("locates active loans by ISBN, card_id, or case-insensitive borrower name substring", async () => {
            const byIsbn = await service.searchActiveLoans("1000000002");
            expect(byIsbn).toEqual([
                {
                    loan_id: 2,
                    isbn: "1000000002",
                    title: "Book Two",
                    card_id: "ID000001",
                    bname: "Alice Johnson",
                    date_out: "2026-11-02",
                    due_date: "2026-11-16",
                },
            ]);

            const byCardId = await service.searchActiveLoans("ID000001");
            expect(byCardId.map((l) => l.loan_id).sort()).toEqual([1, 2, 3]);

            const byName = await service.searchActiveLoans("JOHNSON");
            expect(byName.map((l) => l.loan_id).sort()).toEqual([1, 2, 3]);
        });

        it("excludes already-returned loans from check-in search results", async () => {
            expect(await service.searchActiveLoans("1000000004")).toEqual([]);
            expect(await service.searchActiveLoans("ID000002")).toEqual([]);
            expect(await service.searchActiveLoans("williams")).toEqual([]);
        });

        it("checks in 1 to 3 selected active loans by setting date_in", async () => {
            const returned = await service.checkIn([1, 2, 3], "2026-11-10");

            expect(returned).toHaveLength(3);
            expect(returned.every((l) => l.date_in === "2026-11-10")).toBe(true);
            expect(await service.searchActiveLoans("ID000001")).toEqual([]);

            // Checked-in books can be checked out again immediately
            const reLoan = await service.checkout("1000000001", "ID000002", "2026-11-11");
            expect(reLoan.isbn).toBe("1000000001");
        });

        it("rejects empty lists, more than 3 loan IDs, missing loans, or already-returned loans", async () => {
            await expect(service.checkIn([], "2026-11-10")).rejects.toThrow(BadRequestException);
            await expect(service.checkIn([1, 2, 3, 4], "2026-11-10")).rejects.toThrow(
                BadRequestException,
            );

            // Missing loan ID in a mixed batch must fail and leave valid loan #1 unchecked-in
            await expectClientError(service.checkIn([1, 999], "2026-11-10"));
            const [loan1AfterMissing] = await db
                .select()
                .from(bookLoans)
                .where(eq(bookLoans.loan_id, 1));
            expect(loan1AfterMissing?.date_in).toBeNull();

            // Already-returned loan #4 in a mixed batch must fail and roll back loan #1
            await expectClientError(service.checkIn([1, 4], "2026-11-10"));
            const [loan1AfterReturned] = await db
                .select()
                .from(bookLoans)
                .where(eq(bookLoans.loan_id, 1));
            expect(loan1AfterReturned?.date_in).toBeNull();
        });
    });
});
