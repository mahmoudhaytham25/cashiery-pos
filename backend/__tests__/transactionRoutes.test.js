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

  test('400 + ROLLBACK when a product does not exist', async () => {
    const { client, calls } = createMockClient([
      {},                       // BEGIN
      { rows: [], rowCount: 0 },// SELECT ... FOR UPDATE -> not found
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
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }] }, // SELECT FOR UPDATE
      { rows: [], rowCount: 0 },                       // UPDATE -> guarded, 0 rows
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
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }] },// SELECT FOR UPDATE
      { rows: [], rowCount: 1 },                         // UPDATE stock
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

    // Order: BEGIN -> SELECT FOR UPDATE -> UPDATE -> INSERT txn -> INSERT item -> COMMIT
    expect(queryTexts(calls)).toEqual([
      'BEGIN',
      'SELECT id, name, price FROM products WHERE id = $1 FOR UPDATE',
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
      'INSERT INTO transactions (cashier_id, total) VALUES ($1, $2) RETURNING *',
      'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
      'COMMIT',
    ]);

    // SELECT took the row lock for the right product.
    expect(calls[1].params).toEqual([1]);
    // Stock decrement is guarded by stock >= quantity.
    expect(calls[2].params).toEqual([2, 1]);
    // Cashier id comes from the JWT (id 2), total is computed as 2 * 2.50 = 5 —
    // neither came from the request body.
    expect(calls[3].params).toEqual([2, 5]);
    // Line item uses the transaction id, product, qty and the DB unit price.
    expect(calls[4].params).toEqual([42, 1, 2, 2.5]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('201 handles multi-item checkouts (per-item stock update + line insert)', async () => {
    const txnRow = { id: 50, cashier_id: 2, total: '7.50', timestamp: '2024-06-01T00:00:00Z' };
    const { client, calls } = createMockClient([
      {},                                                // BEGIN
      { rows: [{ id: 1, name: 'Coke', price: '2.50' }] },// item 1 SELECT
      { rows: [], rowCount: 1 },                         // item 1 UPDATE
      { rows: [{ id: 2, name: 'Pepsi', price: '2.50' }] },// item 2 SELECT
      { rows: [], rowCount: 1 },                         // item 2 UPDATE
      { rows: [txnRow], rowCount: 1 },                   // INSERT transactions
      { rows: [], rowCount: 1 },                         // INSERT item 1
      { rows: [], rowCount: 1 },                         // INSERT item 2
      {},                                                // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] });

    expect(res.status).toBe(201);
    // total = 2*2.50 + 1*2.50 = 7.5
    const txnInsert = firstMatch(calls, /INSERT INTO transactions/);
    expect(txnInsert.params).toEqual([2, 7.5]);
    const itemInserts = calls.filter((c) => /INSERT INTO transaction_items/.test(c.text));
    expect(itemInserts).toHaveLength(2);
    expect(itemInserts[0].params).toEqual([50, 1, 2, 2.5]);
    expect(itemInserts[1].params).toEqual([50, 2, 1, 2.5]);
    expect(wasIssued(calls, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('400 + ROLLBACK when a query inside the transaction throws', async () => {
    const { client, calls } = createMockClient([
      {},                              // BEGIN
      new Error('connection lost'),    // SELECT throws
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/transactions')
      .set(CASHIER)
      .send({ items: [{ productId: 1, quantity: 1 }] });

    expect(res.status).toBe(400);
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
    expect(params).toEqual(['2024-06-01']);
  });

  test('200 defaults to today when ?date= is absent', async () => {
    db.query.mockResolvedValue({ rows: [{ totalSales: null, transactionCount: '0' }] });

    const res = await request(app).get('/api/transactions/summary').set(ADMIN);

    expect(res.status).toBe(200);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
