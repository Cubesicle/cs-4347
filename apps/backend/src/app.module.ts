import { createDatabase } from "@cs-4347/db";
import { Module } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";
import { BooksModule } from "./books/books.module";

@Module({
    imports: [
        DrizzleModule.forRootAsync({
            useFactory: () => ({ db: createDatabase() }),
        }),
        BooksModule,
    ],
})
export class AppModule {}
