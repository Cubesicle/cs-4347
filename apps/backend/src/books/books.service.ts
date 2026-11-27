import { type AppDatabase, authors, type Book, bookAuthors, bookLoans, books } from "@cs-4347/db";
import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, asc, eq, exists, isNull, like, or } from "drizzle-orm";

export interface BookSearchResult extends Book {
    authors: string;
    status: "IN" | "OUT";
}

@Injectable()
export class BooksService {
    constructor(@InjectDrizzle() private readonly db: AppDatabase) {}

    async search(query: string): Promise<BookSearchResult[]> {
        const term = query.trim();
        if (!term) {
            return [];
        }

        const pattern = `%${term}%`;

        const matchingAuthor = this.db
            .select({ isbn: bookAuthors.isbn })
            .from(bookAuthors)
            .innerJoin(authors, eq(bookAuthors.author_id, authors.author_id))
            .where(and(eq(bookAuthors.isbn, books.isbn), like(authors.name, pattern)));

        const rows = await this.db
            .select({
                isbn: books.isbn,
                title: books.title,
                authorName: authors.name,
                activeLoanId: bookLoans.loan_id,
            })
            .from(books)
            .leftJoin(bookAuthors, eq(books.isbn, bookAuthors.isbn))
            .leftJoin(authors, eq(bookAuthors.author_id, authors.author_id))
            .leftJoin(bookLoans, and(eq(books.isbn, bookLoans.isbn), isNull(bookLoans.date_in)))
            .where(
                or(like(books.isbn, pattern), like(books.title, pattern), exists(matchingAuthor)),
            )
            .orderBy(asc(books.title), asc(books.isbn), asc(authors.name));

        const results = new Map<
            string,
            { isbn: string; title: string; authors: Set<string>; status: "IN" | "OUT" }
        >();

        for (const row of rows) {
            let entry = results.get(row.isbn);
            if (!entry) {
                entry = {
                    isbn: row.isbn,
                    title: row.title,
                    authors: new Set(),
                    status: row.activeLoanId !== null ? "OUT" : "IN",
                };
                results.set(row.isbn, entry);
            }

            if (row.authorName) {
                entry.authors.add(row.authorName);
            }
        }

        return Array.from(results.values(), ({ isbn, title, authors: authorSet, status }) => ({
            isbn,
            title,
            authors: Array.from(authorSet).join(", "),
            status,
        }));
    }
}
