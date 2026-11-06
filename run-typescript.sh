#!/usr/bin/env bash
bun --cwd=normalize-books-typescript install
bun run ./normalize-books-typescript/index.ts
