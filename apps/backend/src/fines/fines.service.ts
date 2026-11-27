import {
    type AppDatabase,
    type Borrower,
    bookLoans,
    borrowers,
    type Fine,
    fines,
} from "@cs-4347/db";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, asc, eq, inArray } from "drizzle-orm";

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

// Convert dollar amounts to integer cents.
function toCents(amount: string | number): number {
    return Math.round(Number(amount) * 100);
}

// Calculate the number of days between two YYYY-MM-DD dates.
function diffDays(start: string, end: string): number {
    const startTime = Date.parse(`${start}T00:00:00Z`);
    const endTime = Date.parse(`${end}T00:00:00Z`);

    return Math.round((endTime - startTime) / 86_400_000);
}

@Injectable()
export class FinesService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * Calculate and refresh entries in the fines table ($0.25/day).
     *
     * - Insert fines for overdue loans without an existing fine.
     * - Update unpaid fines if their amount has changed.
     * - Never modify paid fines.
     */
    async refreshFines(today?: string): Promise<RefreshFinesSummary> {
        const referenceDate = today ?? new Date().toISOString().slice(0, 10);

        const summary: RefreshFinesSummary = {
            inserted: 0,
            updated: 0,
            unchanged: 0,
        };

        this.db.transaction((tx) => {
            const loans = tx.select().from(bookLoans).all();
            const existingFines = tx.select().from(fines).all();

            const fineMap = new Map(existingFines.map((fine) => [fine.loan_id, fine]));

            for (const loan of loans) {
                const lateDays =
                    loan.date_in !== null
                        ? Math.max(0, diffDays(loan.due_date, loan.date_in))
                        : Math.max(0, diffDays(loan.due_date, referenceDate));

                if (lateDays === 0) {
                    continue;
                }

                const fineCents = lateDays * 25;
                const fineAmount = (fineCents / 100).toFixed(2);
                const existingFine = fineMap.get(loan.loan_id);

                if (!existingFine) {
                    tx.insert(fines)
                        .values({
                            loan_id: loan.loan_id,
                            fine_amt: fineAmount,
                            paid: false,
                        })
                        .run();

                    summary.inserted++;
                } else if (existingFine.paid) {
                    // Already-paid fines must never be modified.
                    summary.unchanged++;
                } else if (toCents(existingFine.fine_amt) !== fineCents) {
                    tx.update(fines)
                        .set({ fine_amt: fineAmount })
                        .where(eq(fines.loan_id, loan.loan_id))
                        .run();

                    summary.updated++;
                } else {
                    summary.unchanged++;
                }
            }
        });

        return summary;
    }

    /**
     * List fines grouped by borrower.
     *
     * - Excludes paid fines by default.
     * - Includes paid fines when includePaid is true.
     * - Formats totals to two decimal places.
     * - Flags borrowers who have an unpaid fine on an unreturned book.
     */
    async listFines(options?: { includePaid?: boolean }): Promise<BorrowerFineSummary[]> {
        const includePaid = options?.includePaid ?? false;

        const baseQuery = this.db
            .select({
                card_id: borrowers.card_id,
                bname: borrowers.bname,
                date_in: bookLoans.date_in,
                fine_amt: fines.fine_amt,
                paid: fines.paid,
            })
            .from(fines)
            .innerJoin(bookLoans, eq(fines.loan_id, bookLoans.loan_id))
            .innerJoin(borrowers, eq(bookLoans.card_id, borrowers.card_id));

        const rows = (includePaid ? baseQuery : baseQuery.where(eq(fines.paid, false)))
            .orderBy(asc(borrowers.card_id))
            .all();

        const borrowerMap = new Map<
            string,
            {
                card_id: string;
                bname: string;
                totalCents: number;
                has_unreturned_books: boolean;
            }
        >();

        for (const row of rows) {
            let borrower = borrowerMap.get(row.card_id);

            if (!borrower) {
                borrower = {
                    card_id: row.card_id,
                    bname: row.bname,
                    totalCents: 0,
                    has_unreturned_books: false,
                };
                borrowerMap.set(row.card_id, borrower);
            }

            borrower.totalCents += toCents(row.fine_amt);

            if (!row.paid && row.date_in === null) {
                borrower.has_unreturned_books = true;
            }
        }

        return Array.from(borrowerMap.values()).map((borrower) => ({
            card_id: borrower.card_id,
            bname: borrower.bname,
            total_fine: (borrower.totalCents / 100).toFixed(2),
            has_unreturned_books: borrower.has_unreturned_books,
        }));
    }

    /**
     * Enter full payment of all unpaid fines for a borrower.
     *
     * - Reject borrowers without unpaid fines.
     * - Reject payment if any unpaid fine belongs to an unreturned book.
     * - Mark all unpaid fines as paid in one transaction.
     */
    async payFines(cardId: Borrower["card_id"]): Promise<PayFinesResult> {
        const normalizedCardId = cardId.trim();

        return this.db.transaction((tx) => {
            const unpaidFines = tx
                .select({
                    loan_id: fines.loan_id,
                    fine_amt: fines.fine_amt,
                    date_in: bookLoans.date_in,
                })
                .from(fines)
                .innerJoin(bookLoans, eq(fines.loan_id, bookLoans.loan_id))
                .where(and(eq(bookLoans.card_id, normalizedCardId), eq(fines.paid, false)))
                .all();

            if (unpaidFines.length === 0) {
                throw new NotFoundException("Borrower has no unpaid fines.");
            }

            // Every unpaid fine must belong to a returned book.
            if (unpaidFines.some((fine) => fine.date_in === null)) {
                throw new BadRequestException(
                    "Cannot pay fines for books that have not been returned.",
                );
            }

            const loanIds = unpaidFines.map((fine) => fine.loan_id);
            const totalCents = unpaidFines.reduce(
                (total, fine) => total + toCents(fine.fine_amt),
                0,
            );

            // Mark all unpaid fines as paid in one operation.
            tx.update(fines)
                .set({ paid: true })
                .where(and(inArray(fines.loan_id, loanIds), eq(fines.paid, false)))
                .run();

            return {
                card_id: normalizedCardId,
                cleared_count: unpaidFines.length,
                total_paid: (totalCents / 100).toFixed(2),
            };
        });
    }
}
