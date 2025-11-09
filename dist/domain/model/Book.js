export class Book {
    id;
    title;
    author;
    isbn;
    published;
    description;
    available;
    currentLoan;
    constructor(id, title, author, isbn, published, description, 
    // available: true if no active loan
    available = true, 
    // current active loan info when available === false
    currentLoan) {
        this.id = id;
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.published = published;
        this.description = description;
        this.available = available;
        this.currentLoan = currentLoan;
    }
    getSummary() {
        return `${this.title} by ${this.author} (${this.published})`;
    }
}
