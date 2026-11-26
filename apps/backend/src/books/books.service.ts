import { type AppDatabase, type Book, books } from "@cs-4347/db";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { asc, eq } from "drizzle-orm";

export interface BookSearchResult extends Book {
    authors: string;
    status: "IN" | "OUT";
}

@Injectable()
export class BooksService {
    constructor(@InjectDrizzle() private readonly db: AppDatabase) {}

    async findAll(): Promise<Book[]> {
        return this.db.select().from(books).orderBy(asc(books.title), asc(books.isbn));
    }

    async findByIsbn(isbn: Book["isbn"]): Promise<Book | undefined> {
        const [book] = await this.db.select().from(books).where(eq(books.isbn, isbn)).limit(1);
        return book;
    }

    /**
     * TODO: Implement case-insensitive substring search across
     * `book.isbn`, `book.title`, and `authors.name`.
     *
     * Return one row per matching book with:
     * - `isbn`
     * - `title`
     * - `authors` (comma-separated list of all authors for that book)
     * - `status` ("IN" if no active `book_loans` row with `date_in IS NULL`, else "OUT")
     */
    async search(_query: string): Promise<BookSearchResult[]> {
        throw new NotImplementedException("TODO: Implement BooksService.search()");
    }
}
