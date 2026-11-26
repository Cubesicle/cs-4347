import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { NotFoundException } from "@nestjs/common";
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
        it("creates and retrieves a borrower by generated card_id", async () => {
            const created = await controller.create({
                bname: "Jane Doe",
                ssn: "123-45-6789",
                address: "1 Main St, Dallas, TX",
            });

            expect(created.card_id).toBe("ID000001");
            expect(await controller.findOne(created.card_id)).toEqual(created);
        });

        it("throws NotFoundException when card_id does not exist", async () => {
            await expect(controller.findOne("ID999999")).rejects.toThrow(NotFoundException);
        });
    });

    describe("GET /api/borrowers?q=...", () => {
        it("delegates the search query to BorrowersService.findAll()", async () => {
            await controller.create({ bname: "Jane Doe", ssn: "1", address: "x" });
            await controller.create({ bname: "John Smith", ssn: "2", address: "x" });

            expect((await controller.findAll()).map((b) => b.bname)).toEqual([
                "Jane Doe",
                "John Smith",
            ]);
            expect((await controller.findAll("smith")).map((b) => b.bname)).toEqual(["John Smith"]);
        });
    });
});
