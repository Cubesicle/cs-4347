import { Module } from "@nestjs/common";
import { BooksModule } from "./books/books.module";
import { DatabaseModule } from "./database/database.module";

@Module({
    imports: [DatabaseModule, BooksModule],
})
export class AppModule {}
