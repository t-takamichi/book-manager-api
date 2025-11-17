## リポジトリパターンを用いた Prisma レプリカの実装を実施したいです

## 概要
- この実装は、サービス層が ClientIssuer を介してデータベース接続先（Primary / Replica / Transaction）を明示的に選択し、そのクライアントをリポジトリに渡すことで、リード・ライト分離とトランザクション一貫性を実現します。

## 実装
- ClientIssuer の定義 (client-issuer.ts)
- データベース接続の管理とルーティングの決定を担う、唯一の窓口です。

```
/ client-issuer.ts

import { PrismaClient, Prisma } from '@prisma/client';

// 💡 環境変数から接続URLを取得することを想定
const primary = new PrismaClient({ 
  datasources: { db: { url: process.env.DATABASE_URL_PRIMARY } } 
});
const replica = new PrismaClient({ 
  datasources: { db: { url: process.env.DATABASE_URL_REPLICA } } 
});

export type PrimaryClient = typeof primary;
export type ReplicaClient = typeof replica;
export type TxClient = Prisma.TransactionClient;
// リポジトリが受け取るクライアント型（ユニオン型）
export type DatabaseClient = PrimaryClient | ReplicaClient | TxClient; 

/**
 * データベース接続の発行元（PrismaClientIssuerに相当）
 * 接続先の選択とトランザクションの開始を担当する。
 */
export class ClientIssuer {
  private primaryClient: PrimaryClient = primary;
  private replicaClient: ReplicaClient = replica;

  /**
   * Primary DB上でトランザクションを開始し、そのTransactionClientを渡します。
   */
  public async transactOnPrimary<T>(
    callback: (tx: TxClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Starting Transaction on PRIMARY.');
    // Primary Clientの $transaction を使用
    return this.primaryClient.$transaction(callback); 
  }

  /**
   * Read Replica Clientを取得し、コールバックに渡します。（Read専用）
   */
  public async queryOnReplica<T>(
    callback: (client: ReplicaClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Executing Read on REPLICA.');
    return callback(this.replicaClient);
  }
  
  /**
   * Primary Clientを直接取得し、コールバックに渡します。（トランザクション不要なWrite用）
   */
  public async executeOnPrimary<T>(
    callback: (client: PrimaryClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Executing Write on PRIMARY (Non-Tx).');
    return callback(this.primaryClient);
  }

  public async disconnect(): Promise<void> {
    await this.primaryClient.$disconnect();
    await this.replicaClient.$disconnect();
  }
}

export const issuer = new ClientIssuer();
```


- ポジトリの定義 (user-repository.ts)
- リポジトリは、渡された DatabaseClient を使用してデータアクセスを実行します。


```
// user-repository.ts

import { User, Prisma } from '@prisma/client';
import { DatabaseClient } from './client-issuer';

export interface UserRepository {
  findById(client: DatabaseClient, id: number): Promise<User | null>;
  create(client: DatabaseClient, data: Prisma.UserCreateInput): Promise<User>;
}

export class PrismaUserRepository implements UserRepository {
  
  /**
   * 渡されたクライアントを使って、UserをIDで検索する。
   * (接続先は client-issuer で決定される)
   */
  public async findById(client: DatabaseClient, id: number): Promise<User | null> {
    return client.user.findUnique({
      where: { id },
    });
  }

  /**
   * 渡されたクライアントを使って、Userを作成する。
   */
  public async create(client: DatabaseClient, data: Prisma.UserCreateInput): Promise<User> {
    return client.user.create({ data });
  }
}
```

- サービス層での利用 (user-service.ts)
- サービス層が ClientIssuer からクライアントを取得し、リポジトリに渡すことでルーティングを制御します。

```
// user-service.ts

import { User } from '@prisma/client';
import { issuer, ClientIssuer } from './client-issuer';
import { PrismaUserRepository, UserRepository } from './user-repository';

export class UserService {
  private issuer: ClientIssuer;
  private userRepo: UserRepository;

  constructor(issuer: ClientIssuer, userRepo: UserRepository) {
    this.issuer = issuer;
    this.userRepo = userRepo;
  }
  
  /**
   * 読み込み処理（Replicaを使用）
   * レプリケーション遅延が許容できるリードクエリ。
   */
  public async getUserDetails(userId: number): Promise<User | null> {
    // 💡 ClientIssuerを通してReplicaクライアントを取得
    return this.issuer.queryOnReplica(async (client) => {
      // リポジトリにReplicaClientを渡す
      return this.userRepo.findById(client, userId);
    });
  }

  /**
   * 書き込み処理（Primaryトランザクションを使用）
   * データの一貫性が必須なWriteクエリ。
   */
  public async registerUser(data: { email: string, name: string }): Promise<User> {
    // 💡 ClientIssuerを通してPrimaryのTransactionClientを取得
    return this.issuer.transactOnPrimary(async (txClient) => {
      // リポジトリにTxClientを渡す
      const newUser = await this.userRepo.create(txClient, data);
      return newUser;
    });
  }
}

// --- 実行例 ---
const userRepo = new PrismaUserRepository();
const userService = new UserService(issuer, userRepo);

async function runExample() {
  // 読み込み処理はReplicaにルーティングされる
  const userDetails = await userService.getUserDetails(101);
  console.log(`User 101 details (via Replica): ${userDetails ? userDetails.name : 'Not Found'}`);

  // 書き込み処理はPrimaryのトランザクション内で実行される
  const newUser = await userService.registerUser({ email: 'new@user.com', name: 'Copilot' });
  console.log(`New user registered (via Primary/Tx): ID ${newUser.id}`);
  
  await issuer.disconnect();
}
// runExample();

```

- シーケンス図：読み込み処理（レプリカへルーティング）
```
sequenceDiagram
    participant App as 外部システム/コントローラー
    participant Service as UserService
    participant Issuer as ClientIssuer
    participant Repo as UserRepository
    participant ReplicaDB as Read Replica DB

    App->>Service: getUserDetails(userId)
    Service->>Issuer: queryOnReplica(callback)
    activate Issuer
    Issuer->>Service: ReplicaClient (client)を渡してcallback実行
    deactivate Issuer
    
    Service->>Repo: findById(client, userId)
    activate Repo
    Repo->>ReplicaDB: client.user.findUnique({where: {id: userId}})
    ReplicaDB-->>Repo: 結果
    Repo-->>Service: 結果
    deactivate Repo

    Service-->>App: 結果
```

承知いたしました。先の回答で提示した内容（実装方針、シーケンス図、詳細説明）をすべて含め、Markdown形式でコピペ可能な一つのブロックにまとめます。

🛠 リポジトリパターンを用いた Prisma クエリルーティング実装（完全版）

この実装は、サービス層が ClientIssuer を介してデータベース接続先（Primary / Replica / Transaction）を明示的に選択し、そのクライアントをリポジトリに渡すことで、リード・ライト分離とトランザクション一貫性を実現します。

1. 🔑 ClientIssuer の定義 (client-issuer.ts)

データベース接続の管理とルーティングの決定を担う、唯一の窓口です。
TypeScript

// client-issuer.ts

import { PrismaClient, Prisma } from '@prisma/client';

// 💡 環境変数から接続URLを取得することを想定
const primary = new PrismaClient({ 
  datasources: { db: { url: process.env.DATABASE_URL_PRIMARY } } 
});
const replica = new PrismaClient({ 
  datasources: { db: { url: process.env.DATABASE_URL_REPLICA } } 
});

export type PrimaryClient = typeof primary;
export type ReplicaClient = typeof replica;
export type TxClient = Prisma.TransactionClient;
// リポジトリが受け取るクライアント型（ユニオン型）
export type DatabaseClient = PrimaryClient | ReplicaClient | TxClient; 

/**
 * データベース接続の発行元（PrismaClientIssuerに相当）
 * 接続先の選択とトランザクションの開始を担当する。
 */
export class ClientIssuer {
  private primaryClient: PrimaryClient = primary;
  private replicaClient: ReplicaClient = replica;

  /**
   * Primary DB上でトランザクションを開始し、そのTransactionClientを渡します。
   */
  public async transactOnPrimary<T>(
    callback: (tx: TxClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Starting Transaction on PRIMARY.');
    // Primary Clientの $transaction を使用
    return this.primaryClient.$transaction(callback); 
  }

  /**
   * Read Replica Clientを取得し、コールバックに渡します。（Read専用）
   */
  public async queryOnReplica<T>(
    callback: (client: ReplicaClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Executing Read on REPLICA.');
    return callback(this.replicaClient);
  }
  
  /**
   * Primary Clientを直接取得し、コールバックに渡します。（トランザクション不要なWrite用）
   */
  public async executeOnPrimary<T>(
    callback: (client: PrimaryClient) => Promise<T>
  ): Promise<T> {
    console.log('[Issuer] Executing Write on PRIMARY (Non-Tx).');
    return callback(this.primaryClient);
  }

  public async disconnect(): Promise<void> {
    await this.primaryClient.$disconnect();
    await this.replicaClient.$disconnect();
  }
}

export const issuer = new ClientIssuer();

2. 🧱 リポジトリの定義 (user-repository.ts)

リポジトリは、渡された DatabaseClient を使用してデータアクセスを実行します。
TypeScript

// user-repository.ts

import { User, Prisma } from '@prisma/client';
import { DatabaseClient } from './client-issuer';

export interface UserRepository {
  findById(client: DatabaseClient, id: number): Promise<User | null>;
  create(client: DatabaseClient, data: Prisma.UserCreateInput): Promise<User>;
}

export class PrismaUserRepository implements UserRepository {
  
  /**
   * 渡されたクライアントを使って、UserをIDで検索する。
   * (接続先は client-issuer で決定される)
   */
  public async findById(client: DatabaseClient, id: number): Promise<User | null> {
    return client.user.findUnique({
      where: { id },
    });
  }

  /**
   * 渡されたクライアントを使って、Userを作成する。
   */
  public async create(client: DatabaseClient, data: Prisma.UserCreateInput): Promise<User> {
    return client.user.create({ data });
  }
}

3. 💼 サービス層での利用 (user-service.ts)

サービス層が ClientIssuer からクライアントを取得し、リポジトリに渡すことでルーティングを制御します。
TypeScript

// user-service.ts

import { User } from '@prisma/client';
import { issuer, ClientIssuer } from './client-issuer';
import { PrismaUserRepository, UserRepository } from './user-repository';

export class UserService {
  private issuer: ClientIssuer;
  private userRepo: UserRepository;

  constructor(issuer: ClientIssuer, userRepo: UserRepository) {
    this.issuer = issuer;
    this.userRepo = userRepo;
  }
  
  /**
   * 読み込み処理（Replicaを使用）
   * レプリケーション遅延が許容できるリードクエリ。
   */
  public async getUserDetails(userId: number): Promise<User | null> {
    // 💡 ClientIssuerを通してReplicaクライアントを取得
    return this.issuer.queryOnReplica(async (client) => {
      // リポジトリにReplicaClientを渡す
      return this.userRepo.findById(client, userId);
    });
  }

  /**
   * 書き込み処理（Primaryトランザクションを使用）
   * データの一貫性が必須なWriteクエリ。
   */
  public async registerUser(data: { email: string, name: string }): Promise<User> {
    // 💡 ClientIssuerを通してPrimaryのTransactionClientを取得
    return this.issuer.transactOnPrimary(async (txClient) => {
      // リポジトリにTxClientを渡す
      const newUser = await this.userRepo.create(txClient, data);
      return newUser;
    });
  }
}

// --- 実行例 ---
const userRepo = new PrismaUserRepository();
const userService = new UserService(issuer, userRepo);

async function runExample() {
  // 読み込み処理はReplicaにルーティングされる
  const userDetails = await userService.getUserDetails(101);
  console.log(`User 101 details (via Replica): ${userDetails ? userDetails.name : 'Not Found'}`);

  // 書き込み処理はPrimaryのトランザクション内で実行される
  const newUser = await userService.registerUser({ email: 'new@user.com', name: 'Copilot' });
  console.log(`New user registered (via Primary/Tx): ID ${newUser.id}`);
  
  await issuer.disconnect();
}
// runExample();

4. 🗺 シーケンス図と詳細説明

シーケンス図：読み込み処理（レプリカへルーティング）

コード スニペット

sequenceDiagram
    participant App as 外部システム/コントローラー
    participant Service as UserService
    participant Issuer as ClientIssuer
    participant Repo as UserRepository
    participant ReplicaDB as Read Replica DB

    App->>Service: getUserDetails(userId)
    Service->>Issuer: queryOnReplica(callback)
    activate Issuer
    Issuer->>Service: ReplicaClient (client)を渡してcallback実行
    deactivate Issuer
    
    Service->>Repo: findById(client, userId)
    activate Repo
    Repo->>ReplicaDB: client.user.findUnique({where: {id: userId}})
    ReplicaDB-->>Repo: 結果
    Repo-->>Service: 結果
    deactivate Repo

    Service-->>App: 結果
```

シーケンス図：書き込み処理（トランザクションでプライマリへルーティング）
```
sequenceDiagram
    participant App as 外部システム/コントローラー
    participant Service as UserService
    participant Issuer as ClientIssuer
    participant Repo as UserRepository
    participant PrimaryDB as Primary DB

    App->>Service: registerUser(data)
    Service->>Issuer: transactOnPrimary(callback)
    activate Issuer
    Issuer->>PrimaryDB: $transactionを開始
    PrimaryDB-->>Issuer: TransactionClient (tx)
    Issuer->>Service: TransactionClient (tx)を渡してcallback実行
    deactivate Issuer
    
    Service->>Repo: create(tx, data)
    activate Repo
    Repo->>PrimaryDB: tx.user.create(data)
    PrimaryDB-->>Repo: 結果 (DB操作完了、コミット待ち)
    Repo-->>Service: 結果
    deactivate Repo
    
    Service-->>Issuer: callback終了
    activate Issuer
    Issuer->>PrimaryDB: $transactionをコミット
    PrimaryDB-->>Issuer: コミット完了
    deactivate Issuer

    Issuer-->>Service: 結果
    Service-->>App: 結果
```

```
ClientIssuer の責務

    接続管理: primaryClient と replicaClient の2つの独立した PrismaClient インスタンスを保持し、接続情報をカプセル化します。

    トランザクション開始: transactOnPrimary<T>(callback) メソッド内で、Primary Client の $transaction を呼び出し、コールバック関数を実行します。これにより、コールバック内のすべてのリポジトリ操作が Primary DB 上で、単一の原子的な処理として実行されることが保証されます。

    接続先提供: サービス層に対し、接続先が確定したクライアント (TxClient や ReplicaClient) を、コールバックの引数として明確に提供します。

2. 🧱 リポジトリ の責務

    接続先からの独立: findById(client: DatabaseClient, id: number) のように、実行に使用するクライアント (client) を引数として受け取るのが鍵です。リポジトリは、渡された client が Primary、Replica、Tx のいずれであるかを意識せず、Prisma の操作を実行するのみです。

    データアクセス抽象化: サービスの要求（create, findById）と、具体的な Prisma クエリ（client.user.create）の間を仲介します。

3. 💼 サービス の責務

    ルーティング制御: 処理のビジネス要件に基づき、this.issuer.queryOnReplica(...)（リードクエリ）や this.issuer.transactOnPrimary(...)（ライトクエリ）を呼び分けることで、クエリの接続先を明示的に決定します。

    依存性の注入 (DI): ClientIssuer と UserRepository をコンストラクタで受け取ることで、コードの疎結合化が実現され、特に単体テスト時にこれらの依存をモックで簡単に置き換えられるようになります。
```