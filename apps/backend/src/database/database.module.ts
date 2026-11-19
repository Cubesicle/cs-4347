import { createDatabase, ensureDatabaseSchema } from "@cs-4347/db-operations";
import type { Database } from "@cs-4347/db-schema";
import { Global, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kysely } from "kysely";

@Global()
@Module({
    providers: [
        {
            provide: Kysely,
            useFactory: () => createDatabase(),
        },
    ],
    exports: [Kysely],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
    constructor(private readonly db: Kysely<Database>) {}

    async onModuleInit(): Promise<void> {
        await ensureDatabaseSchema(this.db);
    }

    async onModuleDestroy(): Promise<void> {
        await this.db.destroy();
    }
}
