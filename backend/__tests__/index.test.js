// Tests for index.js startup behavior:
//  - process.exit(1) when JWT_SECRET is not set (fail-fast guard)
//  - routes mounted + app.listen called when JWT_SECRET is present
//
// express is partially mocked: express() returns a fake app so no real
// listener binds a port, while express.Router stays real for the routers.
// dotenv is mocked so the real backend/.env file cannot silently repopulate
// JWT_SECRET and defeat the "missing secret" test.

jest.mock('../database/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  listen: jest.fn(),
};

jest.mock('express', () => {
  const actual = jest.requireActual('express');
  const mockExpress = jest.fn(() => mockApp);
  mockExpress.Router = actual.Router; // route files call express.Router()
  mockExpress.json = jest.fn(() => 'json-middleware');
  return mockExpress;
});

describe('index.js startup', () => {
  let exitSpy;
  let errorSpy;
  let savedSecret;
  let savedPort;

  beforeEach(() => {
    jest.resetModules();   // re-run index.js fresh in each test
    jest.clearAllMocks();
    savedSecret = process.env.JWT_SECRET;
    savedPort = process.env.PORT;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
    jest.restoreAllMocks();
  });

  test('exits with code 1 and never listens when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => require('../index')).toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
    expect(mockApp.listen).not.toHaveBeenCalled();
  });

  test('mounts all routers and starts listening when JWT_SECRET is set', () => {
    process.env.JWT_SECRET = 'present';
    process.env.PORT = '5050';

    require('../index');

    expect(exitSpy).not.toHaveBeenCalled();
    const mountedPaths = mockApp.use.mock.calls
      .map((call) => call[0])
      .filter((arg) => typeof arg === 'string');
    expect(mountedPaths).toEqual(
      expect.arrayContaining(['/api/auth', '/api/products', '/api/transactions'])
    );
    expect(mockApp.listen).toHaveBeenCalledTimes(1);
    // PORT is parsed with Number(); the listen call gets a numeric port.
    expect(mockApp.listen).toHaveBeenCalledWith(5050, expect.any(Function));
  });
});
