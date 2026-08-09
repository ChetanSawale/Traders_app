const { Client } = require('pg');
require('dotenv').config();

const urls = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  DIRECT_HOST_ESTIMATE: "postgresql://postgres.ntsailqqjikhcdglxfpo:PBG5wCH47wwd6seP@db.ntsailqqjikhcdglxfpo.supabase.co:5432/postgres"
};

async function testConnection(name, connectionString) {
  console.log(`\nTesting connection for: ${name}...`);
  if (!connectionString) {
    console.log(`Skipped: ${name} is not set in env.`);
    return;
  }
  
  const url = connectionString.replace(/"/g, '');
  console.log(`Using URL: ${url.replace(/:[^:@]+@/, ':****@')}`); // Mask password

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`SUCCESS: Connected to ${name} successfully!`);
    const res = await client.query('SELECT NOW()');
    console.log(`Query Result:`, res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`FAILED: ${name} connection failed. Error:`, err.message);
    return false;
  }
}

async function runTests() {
  await testConnection('DATABASE_URL', urls.DATABASE_URL);
  await testConnection('DIRECT_URL', urls.DIRECT_URL);
  await testConnection('DIRECT_HOST_ESTIMATE', urls.DIRECT_HOST_ESTIMATE);
}

runTests();
