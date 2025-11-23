import { PrismaClient } from '@prisma/client';
import logger from '@web/common/logger';

// Primary / Replica 用の PrismaClient 型エイリアス
export type PrimaryClient = PrismaClient;
export type ReplicaClient = PrismaClient;

// PrismaClient.$transaction のコールバックが受け取る `tx` 引数の型を推論します。
// Prisma の内部型に直接依存せず、クライアントのバージョン差やオーバーロードに
// 柔軟に対応するための実装です。
//
// 補足: オーバーロードによって型がユニオンになってしまう問題に対処するため、
// フォールバック判定時にタプルで包む（`[T] extends [never]`）テクニックを使っています。
// これにより条件型の分配を抑止して期待どおりのフォールバック動作を得られます。
// PrismaClient.$transaction のコールバック型（最初のパラメータ）を抜き出すヘルパー
type TransactionCallbackParam<T extends PrismaClient> = Parameters<T['$transaction']>[0];

// トランザクション中に渡される `tx`（TransactionClient）を推論します。
// コールバックが同期／非同期どちらでも対応するため、戻り値を問わず関数の形で
// マッチさせて `tx` の型を取り出します。
type TransactionClientOf<T extends PrismaClient> =
  TransactionCallbackParam<T> extends (tx: infer TC) => unknown ? TC : never;

// 推論に失敗した場合（オーバーロード等でうまく取り出せない場合）は
// `PrimaryClient` をフォールバック型として使います。これにより downstream の
// コードはモデルデリゲート（book, loan など）に安全にアクセスできます。
export type TxClient = [TransactionClientOf<PrimaryClient>] extends [never]
  ? PrimaryClient
  : TransactionClientOf<PrimaryClient>;
// リポジトリが受け取るクライアント型（ユニオン型）
export type DatabaseClient = PrimaryClient | ReplicaClient | TxClient;

// 読み取りに使えるクライアントのエイリアス。Primary と Replica は同じモデル
// デリゲート（book, loan 等）を持つため、読み取り専用処理はどちらでも受け取れる
// ようにしています。
export type ReadClient = PrimaryClient | ReplicaClient;

/**
 * ClientIssuer
 *
 * 役割:
 * - 読み取りは可能な限りレプリカへルーティングし、エラー時はプライマリへフォールバックする
 * - 書き込みはプライマリ上でトランザクションを実行し、直近の書き込み時刻を追跡して
 *   read-after-write の一貫性を担保する
 *
 * 利用方法:
 * アプリケーションのブートストラップで Primary/Replica の PrismaClient を構築し、
 * このクラスに注入してリポジトリから利用してください（ライフサイクル管理のため）。
 */
export class ClientIssuer {
  private primaryClient: PrimaryClient;
  private replicaClient: ReplicaClient;
  // 最終成功書き込み時刻（ミリ秒、UNIX epoch）。read-after-write 判定に使用する。
  private lastWriteAt: number | null = null;

  // 明示的に connect() が呼ばれたかどうか
  private connected = false;

  constructor(primaryClient: PrimaryClient, replicaClient: ReplicaClient) {
    this.primaryClient = primaryClient;
    this.replicaClient = replicaClient;
  }

  public async transactOnPrimary<T>(callback: (tx: TxClient) => Promise<T>): Promise<T> {
    // Primary の $transaction を使って TransactionClient を取得し、コールバックを実行する
    const result = await this.primaryClient.$transaction(async (tx: TxClient) => {
      const r = await callback(tx);
      return r;
    });

    // record a write timestamp after successful transaction commit
    this.lastWriteAt = Date.now();
    return result;
  }

  /**
   * レプリカでのクエリ（オプション）
   * - requireFresh: true の場合、直近の書き込みから maxStaleMs 未満ならプライマリへルーティングする
   * - maxStaleMs: 直近の書き込みと見なす閾値（ミリ秒、デフォルト 2000ms）
   * レプリカでのアクセスが失敗した場合はプライマリへフォールバックする
   */
  public async queryOnReplica<T>(
    callback: (client: ReadClient) => Promise<T>,
    opts?: { requireFresh?: boolean; maxStaleMs?: number },
  ): Promise<T> {
    const requireFresh = !!opts?.requireFresh;
    const maxStaleMs = opts?.maxStaleMs ?? 2000;

    // 直近に書き込みがあり、最新の読み取りが要求される場合はプライマリへルーティングする
    if (requireFresh && this.lastWriteAt !== null) {
      const age = Date.now() - this.lastWriteAt;
      if (age < maxStaleMs) {
        // read-after-write の一貫性確保のためプライマリへルーティングする。
        // executeOnPrimary のシグネチャに合わせてコールバックをそのまま渡す。
        return this.executeOnPrimary((c) => callback(c));
      }
    }

    // まずはレプリカへ投げ、エラーが発生したらプライマリへフォールバックする
    try {
      return await callback(this.replicaClient);
    } catch (e) {
      // フォールバック: レプリカアクセス失敗時は警告を出してプライマリで再実行する
      logger.warn('Replica access failed, falling back to Primary:', e);
      return this.executeOnPrimary((c) => callback(c));
    }
  }

  public async executeOnPrimary<T>(callback: (client: PrimaryClient) => Promise<T>): Promise<T> {
    const result = await callback(this.primaryClient);
    // 書き込み成功後に最終書き込み時刻を更新する
    this.lastWriteAt = Date.now();
    return result;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.primaryClient.$disconnect();
      await this.replicaClient.$disconnect();
    } catch (e) {
      // 切断に失敗しても無視する
    }
  }

  /**
   * 両クライアントへ明示的に接続する（必要な場合に使用）。
   * eager connect を好むときに呼ぶ。
   */
  public async connect(): Promise<void> {
    if (this.connected) return;
    try {
      await this.primaryClient.$connect();
    } catch (e) {
      // プライマリへの接続失敗は致命的なので再スローする
      logger.error('ClientIssuer: primary connect failed', e);
      throw e;
    }
    try {
      await this.replicaClient.$connect();
    } catch (e) {
      // レプリカの接続に失敗してもログを残して処理を継続する
      logger.warn('ClientIssuer: replica connect failed', e);
    }
    this.connected = true;
  }

  /**
   * テスト用: 記録した最終書き込み時刻をクリアする
   */
  public _clearLastWriteForTest(): void {
    this.lastWriteAt = null;
  }
}

// 注意: PrismaClient はアプリケーションのブートストラップで生成して注入する
// ことを推奨します（ライフサイクル管理が容易になるため）。下の
// `createIssuerFromEnv` はテストやローカル向けの便宜的なファクトリです。

/**
 * 簡易ファクトリ: 環境変数から write/read 用の PrismaClient を生成して ClientIssuer を返す
 * テストやローカル用の便宜的な実装。プロダクションでは明示的にブートストラップ側で
 * PrismaClient を生成して注入することを推奨します（connect/disconnect 管理のため）。
 */
export function createIssuerFromEnv(opts?: { writeEnvKey?: string; readEnvKey?: string }) {
  const writeKey = opts?.writeEnvKey ?? 'DATABASE_URL_WRITE';
  const readKey = opts?.readEnvKey ?? 'DATABASE_URL_READ';

  const writeUrl =
    (process.env as Record<string, string | undefined>)[writeKey] ?? process.env.DATABASE_URL;
  const readUrl =
    (process.env as Record<string, string | undefined>)[readKey] ?? process.env.DATABASE_URL;

  const PrismaCtor: any = PrismaClient;
  const prismaWrite = new PrismaCtor({ datasources: { db: { url: writeUrl } } });
  const prismaRead = new PrismaCtor({ datasources: { db: { url: readUrl } } });

  return new ClientIssuer(prismaWrite, prismaRead);
}
