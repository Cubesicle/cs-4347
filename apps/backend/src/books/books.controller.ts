import type { Book } from "@cs-4347/db";
import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { type BookSearchResult, BooksService } from "./books.service";

@Controller("books")
export class BooksController {
    constructor(private readonly booksService: BooksService) {}

    @Get()
    async findAll(@Query("q") query?: string): Promise<Book[] | BookSearchResult[]> {
        // TODO: Once search() is implemented, consider returning BookSearchResult[]
        // for all requests (including empty queries) so authors and IN/OUT status are always included.
        if (query?.trim()) {
            return this.booksService.search(query.trim());
        }
        return this.booksService.findAll();
    }

    @Get(":isbn")
    async findOne(@Param("isbn") isbn: string): Promise<Book> {
        const book = await this.booksService.findByIsbn(isbn);
        if (!book) {
            throw new NotFoundException(`Book with ISBN "${isbn}" was not found.`);
        }
        return book;
    }
}
