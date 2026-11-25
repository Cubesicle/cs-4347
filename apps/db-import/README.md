# db-import

Node.js/TypeScript CLI application (bundled with `@nx/rspack`, tested with Rstest) that imports normalized CSV files from `./data/normalized/` into SQLite using Kysely (`@cs-4347/db-operations` and `@cs-4347/db-schema`).

## Configuration

- `DB_PATH`: SQLite database file path (default: `./data/library.sqlite`)

## Commands

```bash
npx nx run db-import:import
npx nx test db-import
npx nx run db-import:typecheck
npx nx build db-import
```
