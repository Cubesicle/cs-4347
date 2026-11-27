import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { Book } from "@cs-4347/db/schema";
import type { Observable } from "rxjs";

export interface BookSearchResult extends Book {
    authors: string;
    status: "IN" | "OUT";
}

@Injectable({ providedIn: "root" })
export class BooksService {
    private readonly http = inject(HttpClient);

    searchBooks(query: string): Observable<BookSearchResult[]> {
        return this.http.get<BookSearchResult[]>("/api/books", {
            params: { q: query.trim() },
        });
    }
}
