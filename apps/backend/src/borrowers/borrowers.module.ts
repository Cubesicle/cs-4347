import { Module } from "@nestjs/common";
import { BorrowersController } from "./borrowers.controller";
import { BorrowersService } from "./borrowers.service";

@Module({
    controllers: [BorrowersController],
    providers: [BorrowersService],
    exports: [BorrowersService],
})
export class BorrowersModule {}
