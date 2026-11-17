import type { Database } from "@cs-4347/db-schema";
import type { Kysely } from "kysely";

/** Creates the normalized SQLite tables if they do not already exist. */
export async function ensureDatabaseSchema(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("borrowers")
        .ifNotExists()
        .addColumn("card_id", "text", (col) => col.primaryKey().notNull())
        .addColumn("ssn", "text", (col) => col.notNull())
        .addColumn("bname", "text", (col) => col.notNull())
        .addColumn("address", "text", (col) => col.notNull())
        .addColumn("phone", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("books")
        .ifNotExists()
        .addColumn("isbn", "text", (col) => col.primaryKey().notNull())
        .addColumn("title", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("authors")
        .ifNotExists()
        .addColumn("author_id", "integer", (col) => col.primaryKey().notNull())
        .addColumn("name", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("book_authors")
        .ifNotExists()
        .addColumn("isbn", "text", (col) =>
            col.notNull().references("books.isbn").onDelete("cascade"),
        )
        .addColumn("author_id", "integer", (col) =>
            col.notNull().references("authors.author_id").onDelete("cascade"),
        )
        .addPrimaryKeyConstraint("pk_book_authors", ["isbn", "author_id"])
        .execute();
}
