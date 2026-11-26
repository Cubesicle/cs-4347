import { type AppDatabase, borrowers, createDatabase } from "@cs-4347/db";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { BorrowersService, type CreateBorrowerDto } from "./borrowers.service";

const validInput: CreateBorrowerDto = {
    bname: "Jane Doe",
    ssn: "123-45-6789",
    address: "800 W Campbell Rd, Richardson, TX",
    phone: "(972) 883-2111",
};

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
        it("creates a borrower with all fields and an auto-generated card_id", async () => {
            const created = await service.createBorrower(validInput);

            expect(created).toEqual({ card_id: "ID000001", ...validInput });
            expect(await service.findByCardId("ID000001")).toEqual(created);
        });

        it("allows creating a borrower without a phone number (phone = null)", async () => {
            const { phone: _phone, ...withoutPhone } = validInput;

            expect((await service.createBorrower(withoutPhone)).phone).toBeNull();
            expect(
                (await service.createBorrower({ ...validInput, ssn: "987-65-4321", phone: "  " }))
                    .phone,
            ).toBeNull();
        });

        it("trims whitespace from input fields", async () => {
            const created = await service.createBorrower({
                bname: "  Jane Doe ",
                ssn: " 123-45-6789 ",
                address: " 1 Main St ",
                phone: " 555-0100 ",
            });

            expect(created).toMatchObject({
                bname: "Jane Doe",
                ssn: "123-45-6789",
                address: "1 Main St",
                phone: "555-0100",
            });
        });

        it("generates sequential card_id values compatible with ID000001-ID001000", async () => {
            await db.insert(borrowers).values([
                { card_id: "ID000999", ssn: "000-00-0999", bname: "A", address: "x" },
                { card_id: "ID001000", ssn: "000-00-1000", bname: "B", address: "x" },
                { card_id: "ID000001", ssn: "000-00-0001", bname: "C", address: "x" },
            ]);

            const first = await service.createBorrower(validInput);
            const second = await service.createBorrower({ ...validInput, ssn: "987-65-4321" });

            expect(first.card_id).toBe("ID001001");
            expect(second.card_id).toBe("ID001002");
        });

        it("rejects missing or blank bname, ssn, or address", async () => {
            for (const field of ["bname", "ssn", "address"] as const) {
                await expect(
                    service.createBorrower({ ...validInput, [field]: "   " }),
                ).rejects.toThrow(BadRequestException);

                const missing: Partial<CreateBorrowerDto> = { ...validInput };
                delete missing[field];
                await expect(service.createBorrower(missing as CreateBorrowerDto)).rejects.toThrow(
                    BadRequestException,
                );
            }

            expect(await service.findAll()).toEqual([]);
        });

        it("rejects duplicate SSNs with a helpful ConflictException", async () => {
            await service.createBorrower(validInput);

            const attempt = service.createBorrower({ ...validInput, bname: "Someone Else" });
            await expect(attempt).rejects.toThrow(ConflictException);
            await expect(
                service.createBorrower({ ...validInput, bname: "Someone Else" }),
            ).rejects.toThrow(/ID000001/);

            expect(await service.findAll()).toHaveLength(1);
        });
    });

    describe("findAll", () => {
        beforeEach(async () => {
            await db.insert(borrowers).values([
                { card_id: "ID000002", ssn: "1", bname: "Eric Warren", address: "x" },
                { card_id: "ID000001", ssn: "2", bname: "Mark Morgan", address: "x" },
                { card_id: "ID000010", ssn: "3", bname: "Sarah Markham", address: "x" },
            ]);
        });

        it("returns all borrowers ordered by card_id when no query is given", async () => {
            const ids = (await service.findAll()).map((b) => b.card_id);
            expect(ids).toEqual(["ID000001", "ID000002", "ID000010"]);
            expect((await service.findAll("   ")).map((b) => b.card_id)).toEqual(ids);
        });

        it("filters by case-insensitive substring of name", async () => {
            const result = await service.findAll("MARK");
            expect(result.map((b) => b.card_id)).toEqual(["ID000001", "ID000010"]);
        });

        it("filters by card_id substring", async () => {
            expect((await service.findAll("00001")).map((b) => b.card_id)).toEqual([
                "ID000001",
                "ID000010",
            ]);
        });

        it("treats LIKE wildcards in the query literally", async () => {
            expect(await service.findAll("%")).toEqual([]);
            expect(await service.findAll("_")).toEqual([]);
        });
    });

    describe("findByCardId", () => {
        it("returns the borrower or undefined when absent", async () => {
            const created = await service.createBorrower(validInput);

            expect(await service.findByCardId(created.card_id)).toEqual(created);
            expect(await service.findByCardId("ID999999")).toBeUndefined();
        });
    });
});
