import type { Book } from "@cs-4347/db-schema";
import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { BooksService } from "./books.service";

@Controller("books")
export class BooksController {
    constructor(private readonly booksService: BooksService) {}

    @Get()
    async findAll(): Promise<Book[]> {
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
