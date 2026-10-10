// Runs fn(client, abort) inside BEGIN/COMMIT on a dedicated pool client.
// fn returns { status, body } for the route to send; abort(status, body)
// rolls back and short-circuits with that response instead of committing.
// Any other throw rolls back and re-propagates so the route keeps its own
// error mapping. The client is always released.
class TxAbort {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}

const withTransaction = async (pool, fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const abort = (status, body) => { throw new TxAbort(status, body); };
    const out = await fn(client, abort);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e instanceof TxAbort) return e;
    throw e;
  } finally {
    client.release();
  }
};

module.exports = { withTransaction, TxAbort };
