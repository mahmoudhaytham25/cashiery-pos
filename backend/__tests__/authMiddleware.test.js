// Unit tests for middleware/authMiddleware.js — exercised directly with mock
// req/res/next objects (no HTTP layer needed).

jest.mock('../database/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const {
  signToken,
  expiredToken,
  mockRes,
} = require('./helpers/testUtils');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');

describe('authMiddleware', () => {
  let res;
  let next;

  beforeEach(() => {
    res = mockRes();
    next = jest.fn();
  });

  test('401 when the Authorization header is missing entirely', () => {
    const req = { headers: {} };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 when the header has no token part ("Bearer" alone)', () => {
    const req = { headers: { authorization: 'Bearer' } };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 when the scheme is not Bearer', () => {
    const token = signToken({ id: 7, role: 'cashier' });
    const req = { headers: { authorization: `Basic ${token}` } };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 on a malformed/garbage token', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' } };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 on an expired token', () => {
    const req = { headers: { authorization: `Bearer ${expiredToken()}` } };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 on a token signed with the wrong secret', () => {
    const foreign = require('jsonwebtoken').sign(
      { id: 1, role: 'admin' },
      'a-different-secret'
    );
    const req = { headers: { authorization: `Bearer ${foreign}` } };
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('valid token calls next() and attaches decoded payload to req.user', () => {
    const token = signToken({ id: 7, role: 'cashier' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 7, role: 'cashier' });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('adminAuth', () => {
  let res;
  let next;

  beforeEach(() => {
    res = mockRes();
    next = jest.fn();
  });

  test('403 when req.user is absent (no auth ran before it)', () => {
    adminAuth({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('403 for a cashier role', () => {
    adminAuth({ user: { id: 2, role: 'cashier' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('passes through for an admin role', () => {
    adminAuth({ user: { id: 1, role: 'admin' } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
