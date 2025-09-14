// Quick verification script for webhook_delivery_failures columns
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='webhook_delivery_failures' ORDER BY ordinal_position`);
  console.log(cols.rows);
  await client.end();
})();
