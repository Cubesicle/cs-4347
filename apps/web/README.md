# web

Angular frontend application built with `@angular/build:application`, standalone components, zoneless change detection, and Vitest unit tests (`@angular/build:unit-test`).

## Features

- Proxies `/api` requests to `http://localhost:3000` via `proxy.conf.json`.
- Fetches and displays all rows from `GET /api/books` using `BooksService` and shared `Book` types from `@cs-4347/db-schema`.

## Commands

```bash
bunx nx serve web
bunx nx build web
bunx nx test web
bunx nx run web:typecheck
```
