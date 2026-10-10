// Expected client errors thrown from handlers; anything else that reaches
// errorHandler becomes a logged, generic 500 with no internals leaked.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

module.exports = { HttpError, errorHandler };
