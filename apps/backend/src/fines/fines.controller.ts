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
    async refresh(): Promise<RefreshFinesSummary> {
        return this.finesService.refreshFines();
    }

    @Get()
    async list(@Query("includePaid") includePaid?: string): Promise<BorrowerFineSummary[]> {
        return this.finesService.listFines({ includePaid: includePaid === "true" });
    }

    @Post(":cardId/pay")
    async pay(@Param("cardId") cardId: string): Promise<PayFinesResult> {
        return this.finesService.payFines(cardId);
    }
}
