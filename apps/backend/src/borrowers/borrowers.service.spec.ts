import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { BorrowersService } from "./borrowers.service";

describe("BorrowersService", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let service: BorrowersService;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            providers: [BorrowersService],
        }).compile();

        service = moduleRef.get(BorrowersService);
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined with an injected database", () => {
        expect(db).toBeDefined();
        expect(service).toBeDefined();
    });

    describe("createBorrower", () => {
        it.todo("creates a borrower with all fields and an auto-generated card_id");
        it.todo("allows creating a borrower without a phone number (phone = null)");
        it.todo("generates sequential card_id values compatible with ID000001-ID001000");
        it.todo("rejects missing or blank bname, ssn, or address");
        it.todo("rejects duplicate SSNs with a helpful ConflictException");
    });
});
