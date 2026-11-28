import { type AppDatabase, createDatabase } from "@cs-4347/db";
import { BadRequestException, NotFoundException } from "@nestjs/common";
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
        it("creates and retrieves a borrower by generated card_id without ssn", async () => {
            const created = await controller.create({
                bname: "Jane Doe",
                ssn: "123-45-6789",
                address: "1 Main St, Dallas, TX",
            });

            expect(created).toEqual({
                card_id: "ID000001",
                bname: "Jane Doe",
                address: "1 Main St, Dallas, TX",
                phone: null,
            });
            expect("ssn" in created).toBe(false);

            const found = await controller.findOne(created.card_id);
            expect(found).toEqual(created);
            expect("ssn" in found).toBe(false);
        });

        it("throws NotFoundException when card_id does not exist", async () => {
            await expect(controller.findOne("ID999999")).rejects.toThrow(NotFoundException);
        });
    });

    describe("GET /api/borrowers?q=...", () => {
        it("rejects missing or blank search queries with BadRequestException", async () => {
            await controller.create({ bname: "Jane Doe", ssn: "1", address: "x" });

            await expect(controller.search()).rejects.toThrow(BadRequestException);
            await expect(controller.search("")).rejects.toThrow(BadRequestException);
            await expect(controller.search("   ")).rejects.toThrow(BadRequestException);
        });

        it("delegates the search query to BorrowersService.search() and omits ssn", async () => {
            await controller.create({ bname: "Jane Doe", ssn: "1", address: "x" });
            await controller.create({ bname: "John Smith", ssn: "2", address: "x" });

            const results = await controller.search("smith");
            expect(results).toEqual([
                { card_id: "ID000002", bname: "John Smith", address: "x", phone: null },
            ]);
            expect(results.every((b) => !("ssn" in b))).toBe(true);
        });
    });
});
