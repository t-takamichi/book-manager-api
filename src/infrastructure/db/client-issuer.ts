import { PrismaClient } from '@prisma/client';

// Types for Primary/Replica clients are just PrismaClient
export type PrimaryClient = PrismaClient;
export type ReplicaClient = PrismaClient;

/** Transaction client type inference
 * We infer the TransactionClient type from the primary client's $transaction callback parameter.
 * This avoids relying on a direct `Prisma.TransactionClient` export which may not be available
 * across @prisma/client versions.
 */
/**
 * より厳密に $transaction のコールバックシグネチャにマッチさせて TransactionClient を推論します。
 * Prisma の $transaction にはコールバック版と配列版など複数のオーバーロードがあるため、
 * コールバック版のシグネチャに直接マッチする形にして余計なユニオンを避けます。
 */
/**
 * Parameters<T['$transaction']> を使って $transaction の最初の引数（コールバック）を取り出し、
 * それが関数であればその引数 tx の型を推論して TransactionClient とする。
 * 複数オーバーロードがあるケースでも、最初の引数がコールバック関数であれば正しく推論できます。
 */
type TransactionClientOf<T extends PrismaClient> =
  // コールバックが Promise を返す場合
  Parameters<T['$transaction']>[0] extends (tx: infer TC) => Promise<any>
    ? TC
    : // コールバックが同期関数を返す場合
      Parameters<T['$transaction']>[0] extends (tx: infer TC) => any
      ? TC
      : never;

// If our inference failed (rare across some @prisma/client versions), fall back to
// the exported Prisma.TransactionClient type when available.
// If inference fails, fall back to PrimaryClient (PrismaClient) which also exposes
// the model delegates we need (book, loan, etc.). This keeps downstream code
// usable across various @prisma/client versions.
export type TxClient = [TransactionClientOf<PrimaryClient>] extends [never]
  ? PrimaryClient
  : TransactionClientOf<PrimaryClient>;
// リポジトリが受け取るクライアント型（ユニオン型）
export type DatabaseClient = PrimaryClient | ReplicaClient | TxClient;

/**
 * ClientIssuer: Primary/Replica の PrismaClient を保持し、
 * - transactOnPrimary(callback) : Primary 上でトランザクションを開始し TransactionClient をコールバックに渡す
 * - queryOnReplica(callback)   : Replica を使った読み取りを実行
 * - executeOnPrimary(callback) : トランザクションを使わない単発の書き込みを Primary で実行
 */
export class ClientIssuer {
  private primaryClient: PrimaryClient;
  private replicaClient: ReplicaClient;
  // last successful write timestamp (ms since epoch). Used for read-after-write consistency.
  private lastWriteAt: number | null = null;

  // Whether clients have been explicitly connected
  private connected = false;

  constructor(primaryClient: PrimaryClient, replicaClient: ReplicaClient) {
    this.primaryClient = primaryClient;
    this.replicaClient = replicaClient;
  }

  public async transactOnPrimary<T>(callback: (tx: TxClient) => Promise<T>): Promise<T> {
    // Use primary client's $transaction to obtain a TransactionClient and run provided callback.
    const result = await this.primaryClient.$transaction(async (tx: TxClient) => {
      const r = await callback(tx);
      return r;
    });

    // record a write timestamp after successful transaction commit
    this.lastWriteAt = Date.now();
    return result;
  }

  /**
   * Query on replica with options:
   * - requireFresh: if true and recent write exists within maxStaleMs, route to primary to ensure read-after-write
   * - maxStaleMs: threshold in ms to consider a recent write (default 2000ms)
   * If replica access fails, fallback to primary.
   */
  public async queryOnReplica<T>(
    callback: (client: ReplicaClient) => Promise<T>,
    opts?: { requireFresh?: boolean; maxStaleMs?: number },
  ): Promise<T> {
    const requireFresh = !!opts?.requireFresh;
    const maxStaleMs = opts?.maxStaleMs ?? 2000;

    // If the caller requires fresh read and we recently wrote, route to primary.
    if (requireFresh && this.lastWriteAt !== null) {
      const age = Date.now() - this.lastWriteAt;
      if (age < maxStaleMs) {
        return this.executeOnPrimary((c) => callback(c as unknown as ReplicaClient));
      }
    }

    // Try replica first, fallback to primary on error
    try {
      return await callback(this.replicaClient);
    } catch (e) {
      // fallback to primary
      return this.executeOnPrimary((c) => callback(c as unknown as ReplicaClient));
    }
  }

  public async executeOnPrimary<T>(callback: (client: PrimaryClient) => Promise<T>): Promise<T> {
    return callback(this.primaryClient);
  }

  public async disconnect(): Promise<void> {
    try {
      await this.primaryClient.$disconnect();
    } catch (e) {
      // ignore
    }
    try {
      await this.replicaClient.$disconnect();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Explicitly connect both clients. Use when you prefer eager connect instead of lazy connect.
   */
  public async connect(): Promise<void> {
    if (this.connected) return;
    try {
      await this.primaryClient.$connect();
    } catch (e) {
      // rethrow - connecting primary is important
      throw e;
    }
    try {
      await this.replicaClient.$connect();
    } catch (e) {
      // log and continue; replica may be optional
      // console.warn('ClientIssuer: replica connect failed', e);
    }
    this.connected = true;
  }

  /**
   * Forcibly clear recorded write timestamp (used in tests)
   */
  public _clearLastWriteForTest(): void {
    this.lastWriteAt = null;
  }
}

// Note: Do NOT construct a default issuer here. Instead, create PrismaClient instances in
// application bootstrap (e.g. createApp/main) and inject them into ClientIssuer's constructor.
