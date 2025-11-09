declare module '@prisma/client' {
  export class PrismaClient {
    constructor();
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    [key: string]: any;
  }
}
