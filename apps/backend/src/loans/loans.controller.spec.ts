import { type AppDatabase, books, borrowers, createDatabase } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { LoansController } from "./loans.controller";
import { LoansService } from "./loans.service";

describe("LoansController", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let controller: LoansController;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            controllers: [LoansController],
            providers: [LoansService],
        }).compile();

        controller = moduleRef.get(LoansController);

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

    describe("checkout, search, and check-in endpoints", () => {
        it("handles POST /api/loans/checkout", async () => {
            const loan = await controller.checkout({ isbn: "1000000001", card_id: "ID000001" });

            expect(loan.isbn).toBe("1000000001");
            expect(loan.card_id).toBe("ID000001");
            expect(loan.date_in).toBeNull();
        });

        it("handles GET /api/loans?q=...", async () => {
            const loan = await controller.checkout({ isbn: "1000000001", card_id: "ID000001" });

            const results = await controller.searchActive("alice");
            expect(results).toHaveLength(1);
            expect(results[0]?.loan_id).toBe(loan.loan_id);
        });

        it("handles POST /api/loans/checkin for 1-3 loans", async () => {
            const loan1 = await controller.checkout({ isbn: "1000000001", card_id: "ID000001" });
            const loan2 = await controller.checkout({ isbn: "1000000002", card_id: "ID000001" });

            const returned = await controller.checkIn({ loan_ids: [loan1.loan_id, loan2.loan_id] });

            expect(returned).toHaveLength(2);
            expect(returned.every((l) => l.date_in !== null)).toBe(true);
            expect(await controller.searchActive("ID000001")).toEqual([]);
        });
    });
});
