import type { AppDatabase, Borrower, NewBorrower } from "@cs-4347/db";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";

export type CreateBorrowerDto = Omit<NewBorrower, "card_id">;

@Injectable()
export class BorrowersService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * TODO: Create a new borrower in the `borrower` table.
     *
     * Requirements:
     * - Validate non-empty `bname`, `ssn`, and `address` (`phone` is optional / nullable).
     * - Reject duplicate `ssn` with a clear `ConflictException` (one library card per SSN).
     * - Auto-generate the next `card_id` matching existing IDs (e.g., `ID001001` after `ID001000`).
     * - Run inside `this.db.transaction((tx) => ...)` to avoid duplicate ID races.
     */
    async createBorrower(_input: CreateBorrowerDto): Promise<Borrower> {
        throw new NotImplementedException("TODO: Implement BorrowersService.createBorrower()");
    }

    /**
     * TODO: Return borrowers (optionally filtered by card_id or name substring).
     */
    async findAll(_query?: string): Promise<Borrower[]> {
        throw new NotImplementedException("TODO: Implement BorrowersService.findAll()");
    }

    /**
     * TODO: Find a single borrower by `card_id` (or return `undefined`).
     */
    async findByCardId(_cardId: Borrower["card_id"]): Promise<Borrower | undefined> {
        throw new NotImplementedException("TODO: Implement BorrowersService.findByCardId()");
    }
}
