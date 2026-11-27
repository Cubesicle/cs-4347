import { Controller, Get, Query } from "@nestjs/common";
import { type BookSearchResult, BooksService } from "./books.service";

@Controller("books")
export class BooksController {
    constructor(private readonly booksService: BooksService) {}

    @Get()
    async search(@Query("q") query = ""): Promise<BookSearchResult[]> {
        return this.booksService.search(query);
    }
}
