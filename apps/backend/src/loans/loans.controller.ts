import type { BookLoan } from "@cs-4347/db";
import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
    type ActiveLoanSearchResult,
    type CheckInDto,
    type CheckoutDto,
    LoansService,
} from "./loans.service";

@Controller("loans")
export class LoansController {
    constructor(private readonly loansService: LoansService) {}

    @Post("checkout")
    async checkout(@Body() body: CheckoutDto): Promise<BookLoan> {
        return this.loansService.checkout(body.isbn, body.card_id);
    }

    @Get()
    async searchActive(@Query("q") query = ""): Promise<ActiveLoanSearchResult[]> {
        return this.loansService.searchActiveLoans(query);
    }

    @Post("checkin")
    async checkIn(@Body() body: CheckInDto): Promise<BookLoan[]> {
        return this.loansService.checkIn(body.loan_ids);
    }
}
