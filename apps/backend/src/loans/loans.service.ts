import {
    type AppDatabase,
    type Book,
    type BookLoan,
    type Borrower,
    bookLoans,
    books,
    borrowers,
    fines,
} from "@cs-4347/db";
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    NotImplementedException,
} from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, asc, eq, isNull, like, or } from "drizzle-orm";

export type CheckoutDto = Pick<BookLoan, "isbn" | "card_id">;

export interface CheckInDto {
    loan_ids: BookLoan["loan_id"][];
}

export type ActiveLoanSearchResult = Omit<BookLoan, "date_in"> &
    Pick<Book, "title"> &
    Pick<Borrower, "bname">;

const MAX_ACTIVE_LOANS = 3;
const LOAN_DURATION_DAYS = 14;

function addCalendarDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

@Injectable()
export class LoansService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * Checks out a book to a borrower atomically:
     * - Verifies both book and borrower exist.
     * - Rejects checkout if the book is already checked out, the borrower has 3 active loans,
     *   or the borrower has any unpaid fine.
     * - Sets `due_date` to exactly 14 calendar days after `date_out`.
     */
    async checkout(
        isbn: BookLoan["isbn"],
        cardId: BookLoan["card_id"],
        checkoutDate?: BookLoan["date_out"],
    ): Promise<BookLoan> {
        const normalizedIsbn = typeof isbn === "string" ? isbn.trim() : "";
        const normalizedCardId = typeof cardId === "string" ? cardId.trim() : "";

        if (!normalizedIsbn || !normalizedCardId) {
            throw new BadRequestException("Both isbn and card_id are required.");
        }

        const dateOut = checkoutDate ?? new Date().toISOString().slice(0, 10);
        const dueDate = addCalendarDays(dateOut, LOAN_DURATION_DAYS);

        return this.db.transaction((tx) => {
            const book = tx
                .select({ isbn: books.isbn })
                .from(books)
                .where(eq(books.isbn, normalizedIsbn))
                .get();
            if (!book) {
                throw new NotFoundException(`Book with ISBN "${normalizedIsbn}" was not found.`);
            }

            const borrower = tx
                .select({ card_id: borrowers.card_id })
                .from(borrowers)
                .where(eq(borrowers.card_id, normalizedCardId))
                .get();
            if (!borrower) {
                throw new NotFoundException(
                    `Borrower with card ID "${normalizedCardId}" was not found.`,
                );
            }

            const activeBookLoan = tx
                .select({ loan_id: bookLoans.loan_id })
                .from(bookLoans)
                .where(and(eq(bookLoans.isbn, normalizedIsbn), isNull(bookLoans.date_in)))
                .get();
            if (activeBookLoan) {
                throw new ConflictException(
                    `Book with ISBN "${normalizedIsbn}" is already checked out.`,
                );
            }

            const activeBorrowerLoans = tx
                .select({ loan_id: bookLoans.loan_id })
                .from(bookLoans)
                .where(and(eq(bookLoans.card_id, normalizedCardId), isNull(bookLoans.date_in)))
                .all();
            if (activeBorrowerLoans.length >= MAX_ACTIVE_LOANS) {
                throw new ConflictException(
                    `Borrower "${normalizedCardId}" already has the maximum of ${MAX_ACTIVE_LOANS} active loans.`,
                );
            }

            const unpaidFine = tx
                .select({ loan_id: fines.loan_id })
                .from(fines)
                .innerJoin(bookLoans, eq(fines.loan_id, bookLoans.loan_id))
                .where(and(eq(bookLoans.card_id, normalizedCardId), eq(fines.paid, false)))
                .get();
            if (unpaidFine) {
                throw new ConflictException(
                    `Borrower "${normalizedCardId}" has unpaid fines and cannot check out books.`,
                );
            }

            return tx
                .insert(bookLoans)
                .values({
                    isbn: normalizedIsbn,
                    card_id: normalizedCardId,
                    date_out: dateOut,
                    due_date: dueDate,
                    date_in: null,
                })
                .returning()
                .get();
        });
    }

    /**
     * Searches active loans (`date_in IS NULL`) matching any of:
     * - `book.isbn`
     * - `borrower.card_id`
     * - Case-insensitive substring of `borrower.bname`
     */
    async searchActiveLoans(query: string): Promise<ActiveLoanSearchResult[]> {
        const term = query.trim();
        const pattern = `%${term}%`;

        const condition = term
            ? and(
                  isNull(bookLoans.date_in),
                  or(
                      like(bookLoans.isbn, pattern),
                      like(bookLoans.card_id, pattern),
                      like(borrowers.bname, pattern),
                  ),
              )
            : isNull(bookLoans.date_in);

        return this.db
            .select({
                loan_id: bookLoans.loan_id,
                isbn: bookLoans.isbn,
                title: books.title,
                card_id: bookLoans.card_id,
                bname: borrowers.bname,
                date_out: bookLoans.date_out,
                due_date: bookLoans.due_date,
            })
            .from(bookLoans)
            .innerJoin(books, eq(bookLoans.isbn, books.isbn))
            .innerJoin(borrowers, eq(bookLoans.card_id, borrowers.card_id))
            .where(condition)
            .orderBy(asc(bookLoans.loan_id));
    }

    /**
     * TODO: Check in 1 to 3 selected active loans atomically.
     *
     * Requirements:
     * - Validate 1 <= loanIds.length <= 3 (deduplicate / reject invalid counts).
     * - Verify every loan exists and is currently checked out (`date_in IS NULL`).
     * - Set `date_in = returnDate` (default today, `YYYY-MM-DD`) inside `this.db.transaction((tx) => ...)`.
     */
    async checkIn(
        _loanIds: BookLoan["loan_id"][],
        _returnDate?: NonNullable<BookLoan["date_in"]>,
    ): Promise<BookLoan[]> {
        throw new NotImplementedException("TODO: Implement LoansService.checkIn()");
    }
}
