// Legacy server.js - use app.js for the full implementation
const { startServer } = require('./app');

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  startServer();
}
