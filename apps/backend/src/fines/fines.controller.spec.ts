import { type AppDatabase, bookLoans, books, borrowers, createDatabase, fines } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { FinesController } from "./fines.controller";
import { FinesService } from "./fines.service";

describe("FinesController", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let controller: FinesController;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            controllers: [FinesController],
            providers: [FinesService],
        }).compile();

        controller = moduleRef.get(FinesController);

        await db.insert(books).values([
            { isbn: "1000000001", title: "Book One" },
            { isbn: "1000000002", title: "Book Two" },
        ]);
        await db.insert(borrowers).values({
            card_id: "ID000001",
            ssn: "111-11-1111",
            bname: "Alice Johnson",
            address: "100 First St, Dallas, TX",
        });
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined", () => {
        expect(db).toBeDefined();
        expect(controller).toBeDefined();
    });

    describe("fines endpoints", () => {
        it("handles POST /api/fines/refresh", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-01-01",
                due_date: "2026-01-15",
                date_in: "2026-01-19", // 4 days late -> $1.00
            });

            const summary = await controller.refresh();

            expect(summary).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
        });

        it("handles GET /api/fines?includePaid=false|true", async () => {
            await db.insert(bookLoans).values([
                {
                    isbn: "1000000001",
                    card_id: "ID000001",
                    date_out: "2026-01-01",
                    due_date: "2026-01-15",
                    date_in: "2026-01-19",
                },
                {
                    isbn: "1000000002",
                    card_id: "ID000001",
                    date_out: "2026-02-01",
                    due_date: "2026-02-15",
                    date_in: "2026-02-17",
                },
            ]);
            await db.insert(fines).values([
                { loan_id: 1, fine_amt: "1.00", paid: false },
                { loan_id: 2, fine_amt: "0.50", paid: true },
            ]);

            expect(await controller.list()).toEqual([
                {
                    card_id: "ID000001",
                    bname: "Alice Johnson",
                    total_fine: "1.00",
                    has_unreturned_books: false,
                },
            ]);
            expect(await controller.list("true")).toEqual([
                {
                    card_id: "ID000001",
                    bname: "Alice Johnson",
                    total_fine: "1.50",
                    has_unreturned_books: false,
                },
            ]);
        });

        it("handles POST /api/fines/:cardId/pay", async () => {
            await db.insert(bookLoans).values({
                isbn: "1000000001",
                card_id: "ID000001",
                date_out: "2026-01-01",
                due_date: "2026-01-15",
                date_in: "2026-01-19",
            });
            await db.insert(fines).values({ loan_id: 1, fine_amt: "1.00", paid: false });

            const payment = await controller.pay("ID000001");

            expect(payment).toEqual({
                card_id: "ID000001",
                cleared_count: 1,
                total_paid: "1.00",
            });
            expect(await controller.list()).toEqual([]);
        });
    });
});
