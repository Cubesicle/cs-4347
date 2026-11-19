import type { Book, Database } from "@cs-4347/db-schema";
import { Injectable } from "@nestjs/common";
import { Kysely } from "kysely";

@Injectable()
export class BooksService {
    constructor(private readonly db: Kysely<Database>) {}

    async findAll(): Promise<Book[]> {
        return this.db
            .selectFrom("books")
            .select(["isbn", "title"])
            .orderBy("title", "asc")
            .orderBy("isbn", "asc")
            .execute();
    }

    async findByIsbn(isbn: string): Promise<Book | undefined> {
        return this.db
            .selectFrom("books")
            .select(["isbn", "title"])
            .where("isbn", "=", isbn)
            .executeTakeFirst();
    }
}
