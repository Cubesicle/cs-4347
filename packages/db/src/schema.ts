import { sql } from "drizzle-orm";
import {
    check,
    index,
    integer,
    numeric,
    primaryKey,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const books = sqliteTable("book", {
    isbn: text("isbn").primaryKey(),
    title: text("title").notNull(),
});

export const authors = sqliteTable("authors", {
    author_id: integer("author_id").primaryKey(),
    name: text("name").notNull(),
});

export const bookAuthors = sqliteTable(
    "book_authors",
    {
        author_id: integer("author_id")
            .notNull()
            .references(() => authors.author_id, { onDelete: "cascade" }),
        isbn: text("isbn")
            .notNull()
            .references(() => books.isbn, { onDelete: "cascade" }),
    },
    (table) => [
        primaryKey({ name: "pk_book_authors", columns: [table.author_id, table.isbn] }),
        index("idx_book_authors_isbn").on(table.isbn),
    ],
);

export const borrowers = sqliteTable("borrower", {
    card_id: text("card_id").primaryKey(),
    ssn: text("ssn").notNull().unique(),
    bname: text("bname").notNull(),
    address: text("address").notNull(),
    phone: text("phone"),
});

export const bookLoans = sqliteTable(
    "book_loans",
    {
        loan_id: integer("loan_id").primaryKey({ autoIncrement: true }),
        isbn: text("isbn")
            .notNull()
            .references(() => books.isbn, { onDelete: "restrict" }),
        card_id: text("card_id")
            .notNull()
            .references(() => borrowers.card_id, { onDelete: "restrict" }),
        date_out: text("date_out").notNull(),
        due_date: text("due_date").notNull(),
        date_in: text("date_in"),
    },
    (table) => [
        uniqueIndex("idx_book_loans_active_isbn")
            .on(table.isbn)
            .where(sql`${table.date_in} IS NULL`),
        index("idx_book_loans_card_id").on(table.card_id),
        index("idx_book_loans_isbn").on(table.isbn),
    ],
);

export const fines = sqliteTable(
    "fines",
    {
        loan_id: integer("loan_id")
            .primaryKey()
            .references(() => bookLoans.loan_id, { onDelete: "cascade" }),
        fine_amt: numeric("fine_amt").notNull(),
        paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    },
    (table) => [
        check("chk_fines_non_negative", sql`${table.fine_amt} >= 0`),
        check("chk_fines_paid_boolean", sql`${table.paid} IN (0, 1)`),
    ],
);

export type Book = typeof books.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type BookAuthor = typeof bookAuthors.$inferSelect;
export type Borrower = typeof borrowers.$inferSelect;
export type NewBorrower = typeof borrowers.$inferInsert;
export type BookLoan = typeof bookLoans.$inferSelect;
export type NewBookLoan = typeof bookLoans.$inferInsert;
export type Fine = typeof fines.$inferSelect;
export type NewFine = typeof fines.$inferInsert;
