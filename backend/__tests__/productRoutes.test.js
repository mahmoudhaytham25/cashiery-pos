// Tests for routes/productRoutes.js mounted on a real express app with the
// pg pool mocked at the database/db seam.

jest.mock('../database/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require('supertest');
const db = require('../database/db');
const { adminToken, cashierToken, bearer } = require('./helpers/testUtils');
const { buildApp } = require('./helpers/app');

const app = buildApp();

beforeEach(() => {
  jest.resetAllMocks();
});

describe('GET /api/products', () => {
  test('401 without a token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('200 returns all products for a cashier', async () => {
    const rows = [
      { id: 1, name: 'Coke', price: '2.50', stock: 10 },
      { id: 2, name: 'Pepsi', price: '2.00', stock: 5 },
    ];
    db.query.mockResolvedValue({ rows });

    const res = await request(app)
      .get('/api/products')
      .set(bearer(cashierToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(db.query).toHaveBeenCalledWith('SELECT * FROM products ORDER BY name');
  });

  test('200 uses an ILIKE filter when ?search= is given', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/api/products?search=coke')
      .set(bearer(cashierToken()));

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM products WHERE name ILIKE $1 ORDER BY name',
      ['%coke%']
    );
  });

  test('500 when the query fails', async () => {
    db.query.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .get('/api/products')
      .set(bearer(cashierToken()));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
  });
});

describe('GET /api/products/low-stock', () => {
  test('200 returns low-stock products for a cashier', async () => {
    const rows = [{ id: 2, name: 'Pepsi', price: '2.00', stock: 5 }];
    db.query.mockResolvedValue({ rows });

    const res = await request(app)
      .get('/api/products/low-stock')
      .set(bearer(cashierToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM products WHERE stock < 10'
    );
  });
});

describe('POST /api/products', () => {
  const product = { name: 'Fanta', price: 1.75, stock: 20, SKU: 'FAN-001' };

  test('401 without a token', async () => {
    const res = await request(app).post('/api/products').send(product);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('403 for a cashier', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(bearer(cashierToken()))
      .send(product);
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('201 inserts the product for an admin', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/products')
      .set(bearer(adminToken()))
      .send(product);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Product added' });
    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO products (name, price, stock, SKU) VALUES ($1, $2, $3, $4)',
      ['Fanta', 1.75, 20, 'FAN-001']
    );
  });

  test('400 when the insert fails (e.g. duplicate SKU)', async () => {
    db.query.mockRejectedValue(new Error('duplicate key'));

    const res = await request(app)
      .post('/api/products')
      .set(bearer(adminToken()))
      .send(product);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid SKU or missing fields' });
  });
});

describe('PUT /api/products/:id', () => {
  test('403 for a cashier', async () => {
    const res = await request(app)
      .put('/api/products/7')
      .set(bearer(cashierToken()))
      .send({ name: 'X', price: 1, stock: 1 });
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('400 when required fields are missing (no DB call)', async () => {
    const res = await request(app)
      .put('/api/products/7')
      .set(bearer(adminToken()))
      .send({ price: 1.5 }); // no name, no stock

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing required fields' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('200 updates and returns the product; empty SKU is stored as NULL', async () => {
    const updated = { id: 7, name: 'Coke Zero', price: '2.50', stock: 8, SKU: null };
    db.query.mockResolvedValue({ rows: [updated], rowCount: 1 });

    const res = await request(app)
      .put('/api/products/7')
      .set(bearer(adminToken()))
      .send({ name: 'Coke Zero', price: '2.50', stock: '8', SKU: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Product updated successfully',
      product: updated,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      ['Coke Zero', 2.5, 8, null, '7']
    );
  });

  test('404 when no product matches the id', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .put('/api/products/999')
      .set(bearer(adminToken()))
      .send({ name: 'X', price: 1, stock: 1, SKU: 'X-1' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
  });

  test('400 on a unique-SKU violation (23505)', async () => {
    const err = new Error('duplicate key');
    err.code = '23505';
    db.query.mockRejectedValue(err);

    const res = await request(app)
      .put('/api/products/7')
      .set(bearer(adminToken()))
      .send({ name: 'X', price: 1, stock: 1, SKU: 'DUP' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'SKU must be unique' });
  });
});

describe('DELETE /api/products/:productId', () => {
  test('403 for a cashier', async () => {
    const res = await request(app)
      .delete('/api/products/7')
      .set(bearer(cashierToken()));
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('200 deletes and returns the product for an admin', async () => {
    const deleted = { id: 7, name: 'Old', price: '1.00', stock: 0 };
    db.query.mockResolvedValue({ rows: [deleted], rowCount: 1 });

    const res = await request(app)
      .delete('/api/products/7')
      .set(bearer(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Product deleted successfully',
      product: deleted,
    });
    expect(db.query).toHaveBeenCalledWith(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      ['7']
    );
  });

  test('404 when nothing was deleted', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .delete('/api/products/999')
      .set(bearer(adminToken()));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
  });
});
