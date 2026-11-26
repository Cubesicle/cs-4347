import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { BorrowersController } from "./borrowers.controller";
import { BorrowersService } from "./borrowers.service";

describe("BorrowersController", () => {
    let db: AppDatabase;
    let moduleRef: TestingModule;
    let controller: BorrowersController;

    beforeEach(async () => {
        db = createDatabase(":memory:");

        moduleRef = await Test.createTestingModule({
            imports: [DrizzleModule.forRoot({ db })],
            controllers: [BorrowersController],
            providers: [BorrowersService],
        }).compile();

        controller = moduleRef.get(BorrowersController);
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined", () => {
        expect(db).toBeDefined();
        expect(controller).toBeDefined();
    });

    describe("POST /api/borrowers & GET /api/borrowers/:cardId", () => {
        it.todo("creates and retrieves a borrower by generated card_id");
        it.todo("throws NotFoundException when card_id does not exist");
    });
});
