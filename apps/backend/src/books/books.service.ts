import { type AppDatabase, type Book, books } from "@cs-4347/db";
import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { asc, eq } from "drizzle-orm";

@Injectable()
export class BooksService {
    constructor(@InjectDrizzle() private readonly db: AppDatabase) {}

    async findAll(): Promise<Book[]> {
        return this.db.select().from(books).orderBy(asc(books.title), asc(books.isbn));
    }

    async findByIsbn(isbn: string): Promise<Book | undefined> {
        const [book] = await this.db.select().from(books).where(eq(books.isbn, isbn)).limit(1);
        return book;
    }
}
