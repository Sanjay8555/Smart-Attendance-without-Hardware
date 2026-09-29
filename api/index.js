const { app } = require('../server/server');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error('Vercel API Serverless Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Serverless execution error: ' + (err.message || 'Unknown error')
    });
  }
};
