const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const app = require('./app');
const pool = require('./config/db');

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

async function shutDown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
