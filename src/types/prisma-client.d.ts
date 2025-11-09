declare module '@prisma/client' {
  export class PrismaClient {
    constructor();
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    // Very small subset — real client has generated types per schema
    [key: string]: any;
  }
}
