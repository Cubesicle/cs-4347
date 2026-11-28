import { type AppDatabase, type Borrower, borrowers, type NewBorrower } from "@cs-4347/db";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { asc, eq, sql } from "drizzle-orm";

export type CreateBorrowerDto = Omit<NewBorrower, "card_id">;
export type PublicBorrower = Omit<Borrower, "ssn">;

const publicBorrowerColumns = {
    card_id: borrowers.card_id,
    bname: borrowers.bname,
    address: borrowers.address,
    phone: borrowers.phone,
};

const CARD_ID_PREFIX = "ID";
const CARD_ID_DIGITS = 6;

@Injectable()
export class BorrowersService {
    constructor(@InjectDrizzle() protected readonly db: AppDatabase) {}

    /**
     * Creates a new borrower with an auto-generated `card_id` (e.g. `ID001001` after `ID001000`).
     *
     * - `bname`, `ssn`, and `address` are required and must not be blank; `phone` is optional.
     * - A borrower may only hold one library card per SSN (`ConflictException` on duplicates).
     * - The SSN check, ID generation, and insert run in one transaction to avoid duplicate IDs.
     * - Returns the created borrower without `ssn`.
     */
    async createBorrower(input: CreateBorrowerDto): Promise<PublicBorrower> {
        const bname = requireText(input?.bname, "bname");
        const ssn = requireText(input?.ssn, "ssn");
        const address = requireText(input?.address, "address");
        const phone = optionalText(input?.phone, "phone");

        return this.db.transaction((tx) => {
            const existing = tx
                .select({ card_id: borrowers.card_id })
                .from(borrowers)
                .where(eq(borrowers.ssn, ssn))
                .get();
            if (existing) {
                throw new ConflictException(
                    `A borrower with that SSN already exists (card ID "${existing.card_id}"). Only one library card is allowed per SSN.`,
                );
            }

            const { maxId } = tx
                .select({
                    maxId: sql<
                        number | null
                    >`max(cast(substr(${borrowers.card_id}, ${CARD_ID_PREFIX.length + 1}) as integer))`.mapWith(
                        (value: number | bigint | null) => (value === null ? null : Number(value)),
                    ),
                })
                .from(borrowers)
                .where(sql`${borrowers.card_id} LIKE ${`${CARD_ID_PREFIX}%`}`)
                .get() ?? { maxId: null };

            const card_id = formatCardId((maxId ?? 0) + 1);

            return tx
                .insert(borrowers)
                .values({ card_id, ssn, bname, address, phone })
                .returning(publicBorrowerColumns)
                .get();
        });
    }

    /**
     * Searches borrowers ordered by `card_id` matching a case-insensitive substring
     * of `card_id` or `bname`. A non-blank query is required, and `ssn` is omitted.
     */
    async search(query?: string): Promise<PublicBorrower[]> {
        const term = requireText(query, "q");
        const pattern = `%${escapeLike(term)}%`;

        return this.db
            .select(publicBorrowerColumns)
            .from(borrowers)
            .where(
                sql`${borrowers.card_id} LIKE ${pattern} ESCAPE '\\' OR ${borrowers.bname} LIKE ${pattern} ESCAPE '\\'`,
            )
            .orderBy(asc(borrowers.card_id));
    }

    /** Finds a single borrower by `card_id` (without `ssn`), or returns `undefined`. */
    async findByCardId(cardId: Borrower["card_id"]): Promise<PublicBorrower | undefined> {
        const [borrower] = await this.db
            .select(publicBorrowerColumns)
            .from(borrowers)
            .where(eq(borrowers.card_id, cardId.trim()))
            .limit(1);
        return borrower;
    }
}

function formatCardId(n: number): string {
    return `${CARD_ID_PREFIX}${String(n).padStart(CARD_ID_DIGITS, "0")}`;
}

function requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new BadRequestException(`"${field}" is required and must not be blank.`);
    }
    return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") {
        throw new BadRequestException(`"${field}" must be a string.`);
    }
    return value.trim() || null;
}

/** Escapes LIKE wildcards so user input such as `%` or `_` matches literally. */
function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
