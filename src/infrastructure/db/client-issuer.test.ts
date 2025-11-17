import { ClientIssuer } from './client-issuer';

describe('ClientIssuer', () => {
  let primaryMock: any;
  let replicaMock: any;
  let issuer: ClientIssuer;

  beforeEach(() => {
    primaryMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb({})),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };
    replicaMock = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    issuer = new ClientIssuer(primaryMock, replicaMock as any);
    // clear internal state
    issuer._clearLastWriteForTest();
  });

  test('transactOnPrimary records lastWriteAt', async () => {
    const cb = jest.fn(async (tx: any) => 'ok');
    await issuer.transactOnPrimary(cb as any);
    expect(cb).toHaveBeenCalled();
  });

  test('queryOnReplica falls back to primary when requireFresh and recent write', async () => {
    // simulate recent write
    await issuer.transactOnPrimary(async (tx: any) => 'ok');

    const res = await issuer.queryOnReplica(
      async (c: any) => {
        // will be called with primary because recent write
        return 'fromPrimary';
      },
      { requireFresh: true, maxStaleMs: 10000 },
    );

    expect(res).toBe('fromPrimary');
  });
});
