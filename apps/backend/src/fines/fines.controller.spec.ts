import { type AppDatabase, createDatabase } from "@cs-4347/db";
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
    });

    afterEach(async () => {
        await moduleRef.close();
    });

    it("is defined", () => {
        expect(db).toBeDefined();
        expect(controller).toBeDefined();
    });

    describe("fines endpoints", () => {
        it.todo("handles POST /api/fines/refresh");
        it.todo("handles GET /api/fines?includePaid=false|true");
        it.todo("handles POST /api/fines/:cardId/pay");
    });
});
