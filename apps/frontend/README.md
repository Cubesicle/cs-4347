# frontend

Angular frontend application built with `@angular/build:application`, standalone components, zoneless change detection, and Vitest unit tests (`@angular/build:unit-test`).

## Features

- Proxies `/api` requests to `http://localhost:3000` via `proxy.conf.json`.
- Searches books by ISBN, title, or author via `GET /api/books?q=...` using `BooksService` and shared `Book` types from `@cs-4347/db/schema`, displaying ISBN, title, comma-separated authors, and `IN`/`OUT` status.

## Commands

```bash
bunx nx serve frontend
bunx nx build frontend
bunx nx test frontend
bunx nx run frontend:typecheck
```
