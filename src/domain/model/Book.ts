export interface LoanInfo {
  borrower?: string;
  borrowerId?: number;
  staff?: string;
  loanedAt?: string;
  dueAt?: string;
  status?: string;
}

export class Book {
  constructor(
    public id: string,
    public title: string,
    public author: string,
    public isbn: string,
    public published: string,
    public description?: string,
    // available: true if no active loan
    public available: boolean = true,
    // current active loan info when available === false
    public currentLoan?: LoanInfo
  ) {}

  getSummary(): string {
    return `${this.title} by ${this.author} (${this.published})`;
  }
}
