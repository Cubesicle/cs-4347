import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const borrowers = sqliteTable("borrowers", {
    card_id: text("card_id").primaryKey(),
    ssn: text("ssn").notNull(),
    bname: text("bname").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
});

export const books = sqliteTable("books", {
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
        isbn: text("isbn")
            .notNull()
            .references(() => books.isbn, { onDelete: "cascade" }),
        author_id: integer("author_id")
            .notNull()
            .references(() => authors.author_id, { onDelete: "cascade" }),
    },
    (table) => [primaryKey({ name: "pk_book_authors", columns: [table.isbn, table.author_id] })],
);

export type Borrower = typeof borrowers.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type BookAuthor = typeof bookAuthors.$inferSelect;
