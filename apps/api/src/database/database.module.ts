import { createDatabase, ensureDatabaseSchema } from "@cs-4347/database";
import type { Database } from "@cs-4347/db-schema";
import { Global, Inject, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Kysely } from "kysely";

export const DATABASE_TOKEN = Symbol("KYSELY_DATABASE");

@Global()
@Module({
    providers: [
        {
            provide: DATABASE_TOKEN,
            useFactory: () => createDatabase(),
        },
    ],
    exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
    constructor(@Inject(DATABASE_TOKEN) private readonly db: Kysely<Database>) {}

    async onModuleInit(): Promise<void> {
        await ensureDatabaseSchema(this.db);
    }

    async onModuleDestroy(): Promise<void> {
        await this.db.destroy();
    }
}
