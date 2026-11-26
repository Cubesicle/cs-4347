import { createDatabase } from "@cs-4347/db";
import { Module } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { BooksModule } from "./books/books.module";
import { BorrowersModule } from "./borrowers/borrowers.module";
import { FinesModule } from "./fines/fines.module";
import { LoansModule } from "./loans/loans.module";

@Module({
    imports: [
        DrizzleModule.forRootAsync({
            useFactory: () => ({ db: createDatabase() }),
        }),
        BooksModule,
        BorrowersModule,
        LoansModule,
        FinesModule,
    ],
})
export class AppModule {}
