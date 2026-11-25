# cs-4347

Nx monorepo built with **Node.js** (compatible with **npm** and **Bun**), **Angular**, **NestJS**, **Kysely**, and **SQLite**.

## Getting Started

Requires **Node.js 22+** (for built-in `node:sqlite`) or **Bun**. Install dependencies with either `npm` or `bun`:

```bash
npm install # or: bun install
```

## Database Setup

1. Normalize the raw CSV files into `./data/normalized/`:

```bash
npm run normalize # or: bun run normalize
```

2. Import the normalized CSV files into SQLite (defaults to `./data/library.sqlite`, override with `DB_PATH`):

```bash
npm run db:import # or: bun run db:import
```

## Development Servers

Start the NestJS API (`http://localhost:3000/api/books`):

```bash
npm run serve:backend # or: bun run serve:backend
```

Start the Angular frontend (also starts `backend:serve` and proxies `/api` to `http://localhost:3000`):

```bash
npm run serve:frontend # or: bun run serve:frontend
```

## Build, Test, Typecheck & Lint

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```
