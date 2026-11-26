import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { FinesService } from "./fines.service";

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
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined with an injected database", () => {
        expect(db).toBeDefined();
        expect(service).toBeDefined();
    });

    describe("refreshFines", () => {
        it.todo("does not create fines for on-time returned loans or not-yet-due active loans");
        it.todo("calculates (date_in - due_date) * $0.25 for late returned books");
        it.todo("calculates estimated (today - due_date) * $0.25 for overdue unreturned books");
        it.todo("updates an existing unpaid fine without duplicating when the amount changes");
        it.todo("leaves an existing unpaid fine unchanged when the amount is identical");
        it.todo("does nothing when an existing fine row has paid = true");
    });

    describe("listFines & payFines", () => {
        it.todo("groups and sums fines by card_id formatted to two decimal places");
        it.todo("filters out paid fines by default and includes them when includePaid is true");
        it.todo("blocks payment if any unpaid fine belongs to an unreturned book");
        it.todo("clears all unpaid fines for a borrower in full once all books are returned");
        it.todo("rejects payment when the borrower has no unpaid fines");
    });
});
