import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { Book } from "@cs-4347/db/schema";
import type { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class BooksService {
    private readonly http = inject(HttpClient);

    getAllBooks(): Observable<Book[]> {
        return this.http.get<Book[]>("/api/books");
    }
}
