import { type AppDatabase, type Book, books } from "@cs-4347/db";
import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { eq, sql } from "drizzle-orm";

export interface BookSearchResult extends Book {
    authors: string;
    status: "IN" | "OUT";
}

@Injectable()
export class BooksService {
    constructor(@InjectDrizzle() private readonly db: AppDatabase) {}

    async findByIsbn(isbn: Book["isbn"]): Promise<Book | undefined> {
        const [book] = await this.db.select().from(books).where(eq(books.isbn, isbn)).limit(1);
        return book;
    }

    async search(query: string): Promise<BookSearchResult[]> {
        const searchObj = `%${query.trim()}%`;

        return this.db.all<BookSearchResult>(sql`
            SELECT
                b.isbn, b.title,
                COALESCE(
                    (SELECT GROUP_CONCAT(author_list.name, ', ')
                    FROM (
                        SELECT DISTINCT a.name
                        FROM book_authors ba
                        INNER JOIN authors a ON ba.author_id = a.author_id
                        WHERE ba.isbn = b.isbn ORDER BY a.name
                        )
                    AS author_list),''
                ) AS authors,
                 
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM book_loans bl
                        WHERE bl.isbn = b.isbn AND bl.date_in IS NULL
                    )
                    THEN 'OUT'
                    ELSE 'IN'
                END AS status

            FROM book b
            WHERE
                LOWER(b.isbn) LIKE LOWER(${searchObj})
                OR LOWER(b.title) LIKE LOWER(${searchObj})
                OR EXISTS(
                    SELECT 1
                    FROM book_authors ba
                    INNER JOIN authors a ON ba.author_id = a.author_id
                    WHERE ba.isbn = b.isbn AND LOWER(a.name) LIKE LOWER(${searchObj})
                    )
            ORDER BY b.title, b.isbn
            `);
    }
}
