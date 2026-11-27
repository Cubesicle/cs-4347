import { Component, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import { type BookSearchResult, BooksService } from "./books/books.service";

@Component({
    imports: [RouterModule],
    selector: "app-root",
    templateUrl: "./app.html",
    styleUrl: "./app.css",
})
export class App {
    private readonly booksService = inject(BooksService);

    protected readonly title = "Library Book Search";
    protected readonly query = signal("");
    protected readonly books = signal<BookSearchResult[]>([]);
    protected readonly loading = signal(false);
    protected readonly hasSearched = signal(false);
    protected readonly error = signal<string | null>(null);

    protected onQueryInput(event: Event): void {
        this.query.set((event.target as HTMLInputElement).value);
    }

    protected onSearch(event: Event): void {
        event.preventDefault();

        const term = this.query().trim();
        if (!term) {
            this.books.set([]);
            this.hasSearched.set(false);
            this.error.set(null);
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.booksService.searchBooks(term).subscribe({
            next: (rows) => {
                this.books.set(rows);
                this.hasSearched.set(true);
                this.loading.set(false);
            },
            error: () => {
                this.books.set([]);
                this.hasSearched.set(true);
                this.error.set("Failed to search books from /api/books.");
                this.loading.set(false);
            },
        });
    }
}
