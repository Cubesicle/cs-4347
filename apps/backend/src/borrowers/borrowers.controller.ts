import { Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { BorrowersService, type CreateBorrowerDto, type PublicBorrower } from "./borrowers.service";

@Controller("borrowers")
export class BorrowersController {
    constructor(private readonly borrowersService: BorrowersService) {}

    @Post()
    async create(@Body() body: CreateBorrowerDto): Promise<PublicBorrower> {
        return this.borrowersService.createBorrower(body);
    }

    @Get()
    async search(@Query("q") query?: string): Promise<PublicBorrower[]> {
        return this.borrowersService.search(query);
    }

    @Get(":cardId")
    async findOne(@Param("cardId") cardId: string): Promise<PublicBorrower> {
        const borrower = await this.borrowersService.findByCardId(cardId);
        if (!borrower) {
            throw new NotFoundException(`Borrower with card ID "${cardId}" was not found.`);
        }
        return borrower;
    }
}
