import { type AppDatabase, borrowers, createDatabase } from "@cs-4347/db";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { BorrowersService, type CreateBorrowerDto } from "./borrowers.service";

const validInput: CreateBorrowerDto = {
    bname: "Jane Doe",
    ssn: "123-45-6789",
    address: "800 W Campbell Rd, Richardson, TX",
    phone: "(972) 883-2111",
};

const { ssn: _validSsn, ...validPublicFields } = validInput;

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
        it("creates a borrower with an auto-generated card_id and omits ssn from the response", async () => {
            const created = await service.createBorrower(validInput);

            expect(created).toEqual({ card_id: "ID000001", ...validPublicFields });
            expect("ssn" in created).toBe(false);
            expect(await service.findByCardId("ID000001")).toEqual(created);

            const [stored] = await db
                .select()
                .from(borrowers)
                .where(eq(borrowers.card_id, "ID000001"));
            expect(stored?.ssn).toBe(validInput.ssn);
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

            expect(created).toEqual({
                card_id: "ID000001",
                bname: "Jane Doe",
                address: "1 Main St",
                phone: "555-0100",
            });
            expect("ssn" in created).toBe(false);

            const [stored] = await db
                .select()
                .from(borrowers)
                .where(eq(borrowers.card_id, "ID000001"));
            expect(stored?.ssn).toBe("123-45-6789");
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

            expect(await db.select().from(borrowers)).toEqual([]);
        });

        it("rejects duplicate SSNs with a ConflictException without echoing the SSN", async () => {
            await service.createBorrower(validInput);

            try {
                await service.createBorrower({ ...validInput, bname: "Someone Else" });
                expect.unreachable("Expected ConflictException");
            } catch (err) {
                expect(err).toBeInstanceOf(ConflictException);
                expect((err as ConflictException).message).toContain("ID000001");
                expect((err as ConflictException).message).not.toContain(validInput.ssn);
            }

            expect(await db.select().from(borrowers)).toHaveLength(1);
        });
    });

    describe("search", () => {
        beforeEach(async () => {
            await db.insert(borrowers).values([
                { card_id: "ID000002", ssn: "111-11-1111", bname: "Eric Warren", address: "x" },
                { card_id: "ID000001", ssn: "222-22-2222", bname: "Mark Morgan", address: "x" },
                { card_id: "ID000010", ssn: "333-33-3333", bname: "Sarah Markham", address: "x" },
            ]);
        });

        it("requires a non-blank query so the entire borrowers table is not returned", async () => {
            await expect(service.search()).rejects.toThrow(BadRequestException);
            await expect(service.search("")).rejects.toThrow(BadRequestException);
            await expect(service.search("   ")).rejects.toThrow(BadRequestException);
        });

        it("filters by case-insensitive substring of name and omits ssn", async () => {
            const result = await service.search("MARK");
            expect(result).toEqual([
                { card_id: "ID000001", bname: "Mark Morgan", address: "x", phone: null },
                { card_id: "ID000010", bname: "Sarah Markham", address: "x", phone: null },
            ]);
            for (const borrower of result) {
                expect("ssn" in borrower).toBe(false);
            }
        });

        it("filters by card_id substring", async () => {
            expect((await service.search("00001")).map((b) => b.card_id)).toEqual([
                "ID000001",
                "ID000010",
            ]);
        });

        it("treats LIKE wildcards in the query literally", async () => {
            expect(await service.search("%")).toEqual([]);
            expect(await service.search("_")).toEqual([]);
        });
    });

    describe("findByCardId", () => {
        it("returns the borrower without ssn, or undefined when absent", async () => {
            const created = await service.createBorrower(validInput);
            const found = await service.findByCardId(created.card_id);

            expect(found).toEqual(created);
            expect(found && "ssn" in found).toBe(false);
            expect(await service.findByCardId("ID999999")).toBeUndefined();
        });
    });
});
