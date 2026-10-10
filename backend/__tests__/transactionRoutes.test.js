// Tests for routes/transactionRoutes.js — the checkout path is exercised
// against a queued-result mock pg client so we can assert both the HTTP
// status AND the exact SQL/BEGIN/COMMIT/ROLLBACK sequence issued.

jest.mock('../database/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require('supertest');
const db = require('../database/db');
const {
  adminToken,
  cashierToken,
  bearer,
  createMockClient,
  queryTexts,
  wasIssued,
  firstMatch,
} = require('./helpers/testUtils');
const { buildApp } = require('./helpers/app');

const app = buildApp();
const CASHIER = bearer(cashierToken()); // cashier token carries id: 2
const ADMIN = bearer(adminToken());

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/transactions', () => {
  test('401 without a token', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ items: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(401);
    expect(db.connect).not.toHaveBeenCalled();
  });

  test.each([
    ['missing items', {}],
    ['items not an array', { items: { productId: 1, quantity: 1 } }],
    ['empty items array', { items: [] }],
  ])('400 on malformed body: %s', async (_label, body) => {
    const res = await request(app).post('/api/transactions').set(CASHIER).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Items are required' });
    expect(db.connect).not.toHaveBeenCalled();
  });

  test.each([
    ['non-integer productId', { productId: 'abc', quantity: 1 }],
    ['zero productId', { productId: 0, quantity: 1 }],
    ['zero quantity', { productId: 1, quantity: 0 }],
    ['negative quantity', { productId: 1, quantity: -2 }],
    ['non-integer quantity', { productId: 1, quantity: 1.5 }],
  ])('400 on invalid item: %s', async (_label, item) => {
    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [item] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Each item must have a valid productId and a positive integer quantity',
    });
    expect(db.connect).not.toHaveBeenCalled();
  });

  test('400 when items exceed the 100-item cap (no DB call)', async () => {
    const items = Array.from({ length: 101 }, () => ({ productId: 1, quantity: 1 }));

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Too many items (max 100)' });
    expect(db.connect).not.toHaveBeenCalled();
  });

  test('merges duplicate productIds and locks rows in ascending order', async () => {
    const txnRow = { id: 60, cashier_id: 2, total: '12.50', timestamp: '2024-06-01T00:00:00Z' };
    const { client, calls } = createMockClient([
      {},                                                // BEGIN
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }], rowCount: 1 }, // item 1 UPDATE
      { rows: [{ id: 2, name: 'Pepsi', price: '2.50' }], rowCount: 1 },// item 2 UPDATE
      { rows: [txnRow], rowCount: 1 },                   // INSERT transactions
      { rows: [], rowCount: 1 },                         // INSERT items (unnest)
      {},                                                // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      // Product 2 is listed first and product 1 appears twice on purpose.
      .send({ items: [
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 1 },
        { productId: 1, quantity: 2 },
      ] });

    expect(res.status).toBe(201);

    // Locks happen in ascending productId order regardless of request order,
    // and the duplicate productId was merged into a single qty-3 update.
    const updates = calls.filter((c) => /UPDATE products SET stock/.test(c.text));
    expect(updates).toHaveLength(2);
    expect(updates[0].params).toEqual([3, 1]);
    expect(updates[1].params).toEqual([1, 2]);

    // total = 3*2.50 + 1*2.50 = 10 — computed in integer cents.
    const txnInsert = firstMatch(calls, /INSERT INTO transactions \(/);
    expect(txnInsert.params).toEqual([2, 10]);
    // All line items go in as one unnest() insert with parallel arrays.
    const itemInserts = calls.filter((c) => /INSERT INTO transaction_items/.test(c.text));
    expect(itemInserts).toHaveLength(1);
    expect(itemInserts[0].params).toEqual([60, [1, 2], [3, 1], [2.5, 2.5]]);
    expect(wasIssued(calls, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('500 when the pool cannot hand out a client (no client.release crash)', async () => {
    db.connect.mockRejectedValue(new Error('pool exhausted'));

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 1 }] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Transaction failed' });
  });

  test('400 + ROLLBACK when a product does not exist', async () => {
    const { client, calls } = createMockClient([
      {},                       // BEGIN
      { rows: [], rowCount: 0 },// UPDATE ... RETURNING -> 0 rows
      { rows: [], rowCount: 0 },// follow-up SELECT -> product does not exist
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 9, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Product 9 not found' });
    expect(queryTexts(calls)[0]).toBe('BEGIN');
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(wasIssued(calls, 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('409 + ROLLBACK when stock is insufficient (atomic UPDATE guard)', async () => {
    const { client, calls } = createMockClient([
      {},                                              // BEGIN
      { rows: [], rowCount: 0 },                       // UPDATE -> guarded, 0 rows
      { rows: [{ id: 1, name: 'Coke' }] },             // follow-up SELECT -> product exists
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Insufficient stock for Coke' });

    // The stock decrement must be conditional on enough stock (stock >= $1),
    // and no transaction row may be written.
    const update = firstMatch(calls, /UPDATE products SET stock/);
    expect(update.text).toContain('stock >= $1');
    expect(update.params).toEqual([10, 1]);
    expect(firstMatch(calls, /INSERT INTO transactions/)).toBeUndefined();
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(wasIssued(calls, 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('201 commits and computes the total server-side (ignores body total/cashier_id)', async () => {
    const txnRow = { id: 42, cashier_id: 2, total: '5.00', timestamp: '2024-06-01T00:00:00Z' };
    const { client, calls } = createMockClient([
      {},                                                // BEGIN
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }], rowCount: 1 }, // UPDATE stock
      { rows: [txnRow], rowCount: 1 },                   // INSERT transactions
      { rows: [], rowCount: 1 },                         // INSERT transaction_items
      {},                                                // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({
        // Malicious fields a client should not be able to set:
        items: [{ productId: 1, quantity: 2 }],
        total: 9999,
        cashier_id: 999,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(txnRow);

    // Order: BEGIN -> UPDATE..RETURNING -> INSERT txn -> INSERT items -> COMMIT
    expect(queryTexts(calls)).toEqual([
      'BEGIN',
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id, name, price',
      'INSERT INTO transactions (cashier_id, total) VALUES ($1, $2) RETURNING *',
      'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price) SELECT $1, * FROM unnest($2::int[], $3::int[], $4::numeric[])',
      'COMMIT',
    ]);

    // Stock decrement is guarded by stock >= quantity.
    expect(calls[1].params).toEqual([2, 1]);
    // Cashier id comes from the JWT (id 2), total is computed as 2 * 2.50 = 5 —
    // neither came from the request body.
    expect(calls[2].params).toEqual([2, 5]);
    // Line items go in as parallel arrays: transaction id, product, qty, DB price.
    expect(calls[3].params).toEqual([42, [1], [2], [2.5]]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('201 handles multi-item checkouts (per-item stock update + line insert)', async () => {
    const txnRow = { id: 50, cashier_id: 2, total: '7.50', timestamp: '2024-06-01T00:00:00Z' };
    const { client, calls } = createMockClient([
      {},                                                // BEGIN
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }], rowCount: 1 }, // item 1 UPDATE
      { rows: [{ id: 2, name: 'Pepsi', price: '2.50' }], rowCount: 1 },// item 2 UPDATE
      { rows: [txnRow], rowCount: 1 },                   // INSERT transactions
      { rows: [], rowCount: 1 },                         // INSERT items (unnest)
      {},                                                // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] });

    expect(res.status).toBe(201);
    // total = 2*2.50 + 1*2.50 = 7.5
    const txnInsert = firstMatch(calls, /INSERT INTO transactions \(/);
    expect(txnInsert.params).toEqual([2, 7.5]);
    const itemInserts = calls.filter((c) => /INSERT INTO transaction_items/.test(c.text));
    expect(itemInserts).toHaveLength(1);
    expect(itemInserts[0].params).toEqual([50, [1, 2], [2, 1], [2.5, 2.5]]);
    expect(wasIssued(calls, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('500 + ROLLBACK when a query inside the transaction throws', async () => {
    const { client, calls } = createMockClient([
      {},                              // BEGIN
      new Error('connection lost'),    // UPDATE throws
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 1 }] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Transaction failed' });
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(wasIssued(calls, 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/transactions', () => {
  test('401 without a token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('403 for a cashier', async () => {
    const res = await request(app).get('/api/transactions').set(CASHIER);
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('200 returns rows with a newest-first ORDER BY and LEFT JOIN users', async () => {
    const rows = [
      { id: 2, cashier_id: 2, total: '5.00', username: 'bob' },
      { id: 1, cashier_id: null, total: '3.00', username: 'Deleted user' },
    ];
    db.query.mockResolvedValue({ rows });

    const res = await request(app).get('/api/transactions').set(ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/LEFT JOIN users/i);
    expect(sql).toMatch(/ORDER BY t\.timestamp DESC/i);
  });

  test('500 when the query fails', async () => {
    db.query.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/transactions').set(ADMIN);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
  });
});

describe('GET /api/transactions/summary', () => {
  test('403 for a cashier', async () => {
    const res = await request(app).get('/api/transactions/summary').set(CASHIER);
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('200 aggregates sales for an explicit ?date=', async () => {
    db.query.mockResolvedValue({
      rows: [{ totalSales: '123.45', transactionCount: '4' }],
    });

    const res = await request(app)
      .get('/api/transactions/summary?date=2024-06-01')
      .set(ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalSales: '123.45', transactionCount: '4' });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/SUM\(total\)/i);
    // Sargable half-open range instead of DATE("timestamp") = $1
    expect(sql).toContain('"timestamp" >= $1::date');
    expect(sql).toContain(`"timestamp" < $1::date + interval '1 day'`);
    expect(params).toEqual(['2024-06-01']);
  });

  test.each(['2024/06/01', 'not-a-date', '06-01-2024', '2024-6-1'])(
    '400 on malformed ?date=%s (no DB call)',
    async (date) => {
      const res = await request(app)
        .get(`/api/transactions/summary?date=${date}`)
        .set(ADMIN);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid date format (expected YYYY-MM-DD)' });
      expect(db.query).not.toHaveBeenCalled();
    }
  );

  test('200 defaults to today when ?date= is absent', async () => {
    db.query.mockResolvedValue({ rows: [{ totalSales: null, transactionCount: '0' }] });

    const res = await request(app).get('/api/transactions/summary').set(ADMIN);

    expect(res.status).toBe(200);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
