import type { AppDatabase, Borrower, Fine } from "@cs-4347/db";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";

export interface RefreshFinesSummary {
    inserted: number;
    updated: number;
    unchanged: number;
}

export interface BorrowerFineSummary extends Pick<Borrower, "card_id" | "bname"> {
    total_fine: Fine["fine_amt"];
    has_unreturned_books: boolean;
}

export interface PayFinesResult extends Pick<Borrower, "card_id"> {
    cleared_count: number;
    total_paid: Fine["fine_amt"];
}

@Injectable()
export class FinesService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * TODO: Calculate and refresh entries in the `fines` table ($0.25/day).
     *
     * Scenarios:
     * 1. Returned late (`date_in IS NOT NULL` and `date_in > due_date`):
     *    fine = diffDays(due_date, date_in) * $0.25
     * 2. Still checked out & overdue (`date_in IS NULL` and `today > due_date`):
     *    estimated fine = diffDays(due_date, today) * $0.25
     *
     * Upsert rules for each late `book_loans` record:
     * - No existing `fines` row -> insert with `paid = false`.
     * - Existing row with `paid === false` -> update `fine_amt` only if amount changed (compare in cents!).
     * - Existing row with `paid === true` -> do nothing.
     */
    async refreshFines(_today?: string): Promise<RefreshFinesSummary> {
        throw new NotImplementedException("TODO: Implement FinesService.refreshFines()");
    }

    /**
     * TODO: List fines grouped by `borrower.card_id` with summed `fine_amt` (2 decimal places).
     *
     * Requirements:
     * - Filter out previously paid fines (`paid === true`) when `includePaid` is false (default).
     * - Format `total_fine` to 2 decimal places (e.g. `"1.50"`).
     */
    async listFines(_options?: { includePaid?: boolean }): Promise<BorrowerFineSummary[]> {
        throw new NotImplementedException("TODO: Implement FinesService.listFines()");
    }

    /**
     * TODO: Enter full payment of all unpaid fines for a borrower (`paid = true`).
     *
     * Requirements:
     * - Fail if borrower has no unpaid fines.
     * - Reject payment if ANY unpaid fine belongs to a book that is not yet returned (`date_in IS NULL`).
     * - Do not allow partial payments: clear all unpaid fines for `cardId` in one transaction.
     */
    async payFines(_cardId: Borrower["card_id"]): Promise<PayFinesResult> {
        throw new NotImplementedException("TODO: Implement FinesService.payFines()");
    }
}
