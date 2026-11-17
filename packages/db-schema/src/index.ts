import type { Selectable } from "kysely";

export interface BorrowersTable {
    card_id: string;
    ssn: string;
    bname: string;
    address: string;
    phone: string;
}

export interface BooksTable {
    isbn: string;
    title: string;
}

export interface AuthorsTable {
    author_id: number;
    name: string;
}

export interface BookAuthorsTable {
    isbn: string;
    author_id: number;
}

export interface Database {
    borrowers: BorrowersTable;
    books: BooksTable;
    authors: AuthorsTable;
    book_authors: BookAuthorsTable;
}

export type Borrower = Selectable<BorrowersTable>;
export type Book = Selectable<BooksTable>;
export type Author = Selectable<AuthorsTable>;
export type BookAuthor = Selectable<BookAuthorsTable>;
