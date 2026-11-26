import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { LoansService } from "./loans.service";

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
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined with an injected database", () => {
        expect(db).toBeDefined();
        expect(service).toBeDefined();
    });

    describe("checkout", () => {
        it.todo("creates a loan with due_date set to exactly 14 calendar days from date_out");
        it.todo("fails with NotFoundException when ISBN or card_id does not exist");
        it.todo("fails when the book is already checked out by another or the same borrower");
        it.todo("fails when the borrower already has 3 active loans");
        it.todo("allows checkout when a borrower has returned past loans and fewer than 3 active");
        it.todo("fails when the borrower has any unpaid fine");
        it.todo("allows checkout once all previous fines have been paid");
    });

    describe("searchActiveLoans & checkIn", () => {
        it.todo(
            "locates active loans by ISBN, card_id, or case-insensitive borrower name substring",
        );
        it.todo("excludes already-returned loans from check-in search results");
        it.todo("checks in 1 to 3 selected active loans by setting date_in");
        it.todo(
            "rejects empty lists, more than 3 loan IDs, missing loans, or already-returned loans",
        );
    });
});
