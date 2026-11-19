import { Component, inject, type OnInit, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import type { Book } from "@cs-4347/db-schema";
import { BooksService } from "./books/books.service";

@Component({
    imports: [RouterModule],
    selector: "app-root",
    templateUrl: "./app.html",
    styleUrl: "./app.scss",
})
export class App implements OnInit {
    private readonly booksService = inject(BooksService);

    protected readonly title = "Library Books";
    protected readonly books = signal<Book[]>([]);
    protected readonly loading = signal<boolean>(true);
    protected readonly error = signal<string | null>(null);

    ngOnInit(): void {
        this.booksService.getAllBooks().subscribe({
            next: (rows) => {
                this.books.set(rows);
                this.loading.set(false);
            },
            error: () => {
                this.error.set("Failed to load books from /api/books.");
                this.loading.set(false);
            },
        });
    }
}
