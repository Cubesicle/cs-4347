import type { AppDatabase, BookLoan } from "@cs-4347/db";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";

export interface CheckoutDto {
    isbn: string;
    card_id: string;
}

export interface CheckInDto {
    loan_ids: number[];
}

export interface ActiveLoanSearchResult {
    loan_id: number;
    isbn: string;
    title: string;
    card_id: string;
    bname: string;
    date_out: string;
    due_date: string;
}

@Injectable()
export class LoansService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * TODO: Check out a book to a borrower.
     *
     * Requirements (run atomically inside `this.db.transaction((tx) => ...)`):
     * - Verify the book (`isbn`) and borrower (`card_id`) exist (`NotFoundException`).
     * - Fail if the book is already checked out by any borrower (`date_in IS NULL`).
     * - Fail if the borrower already has 3 active loans (`date_in IS NULL`).
     * - Fail if the borrower has any unpaid fine (`fines.paid = false`).
     * - Insert a new `book_loans` row with `date_out = checkoutDate` (default today, `YYYY-MM-DD`),
     *   `due_date = date_out + 14 calendar days`, and `date_in = null`.
     */
    async checkout(_isbn: string, _cardId: string, _checkoutDate?: string): Promise<BookLoan> {
        throw new NotImplementedException("TODO: Implement LoansService.checkout()");
    }

    /**
     * TODO: Search active loans (`date_in IS NULL`) matching any of:
     * - `book.isbn`
     * - `borrower.card_id`
     * - Case-insensitive substring of `borrower.bname`
     */
    async searchActiveLoans(_query: string): Promise<ActiveLoanSearchResult[]> {
        throw new NotImplementedException("TODO: Implement LoansService.searchActiveLoans()");
    }

    /**
     * TODO: Check in 1 to 3 selected active loans atomically.
     *
     * Requirements:
     * - Validate 1 <= loanIds.length <= 3 (deduplicate / reject invalid counts).
     * - Verify every loan exists and is currently checked out (`date_in IS NULL`).
     * - Set `date_in = returnDate` (default today, `YYYY-MM-DD`) inside `this.db.transaction((tx) => ...)`.
     */
    async checkIn(_loanIds: number[], _returnDate?: string): Promise<BookLoan[]> {
        throw new NotImplementedException("TODO: Implement LoansService.checkIn()");
    }
}
