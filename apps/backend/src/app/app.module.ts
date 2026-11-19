import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { DatabaseModule } from "../database/database.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
    imports: [DatabaseModule, BooksModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
