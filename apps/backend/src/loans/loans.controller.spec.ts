import { type AppDatabase, createDatabase } from "@cs-4347/db";
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
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined", () => {
        expect(db).toBeDefined();
        expect(controller).toBeDefined();
    });

    describe("checkout, search, and check-in endpoints", () => {
        it.todo("handles POST /api/loans/checkout");
        it.todo("handles GET /api/loans?q=...");
        it.todo("handles POST /api/loans/checkin for 1-3 loans");
    });
});
