import type { Borrower } from "@cs-4347/db";
import { Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { BorrowersService, type CreateBorrowerDto } from "./borrowers.service";

@Controller("borrowers")
export class BorrowersController {
    constructor(private readonly borrowersService: BorrowersService) {}

    @Post()
    async create(@Body() body: CreateBorrowerDto): Promise<Borrower> {
        return this.borrowersService.createBorrower(body);
    }

    @Get()
    async findAll(@Query("q") query?: string): Promise<Borrower[]> {
        return this.borrowersService.findAll(query);
    }

    @Get(":cardId")
    async findOne(@Param("cardId") cardId: string): Promise<Borrower> {
        const borrower = await this.borrowersService.findByCardId(cardId);
        if (!borrower) {
            throw new NotFoundException(`Borrower with card ID "${cardId}" was not found.`);
        }
        return borrower;
    }
}
