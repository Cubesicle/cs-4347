import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
    type BorrowerFineSummary,
    FinesService,
    type PayFinesResult,
    type RefreshFinesSummary,
} from "./fines.service";

@Controller("fines")
export class FinesController {
    constructor(private readonly finesService: FinesService) {}

    @Post("refresh")
    refresh(): RefreshFinesSummary {
        return this.finesService.refreshFines();
    }

    @Get()
    list(
        @Query("includePaid") includePaid?: string,
    ): BorrowerFineSummary[] {
        return this.finesService.listFines({
            includePaid: includePaid === "true",
        });
    }

    @Post(":cardId/pay")
    pay(
        @Param("cardId") cardId: string,
    ): PayFinesResult {
        return this.finesService.payFines(cardId);
    }
}
