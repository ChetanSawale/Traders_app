import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

export const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'tradesphere',
        password: process.env.DB_PASSWORD || 'postgres',
        port: Number(process.env.DB_PORT) || 5432,
      }
);

export async function initDatabase() {
  console.log('Initializing PostgreSQL database connection...');
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');
    
    // Read and run schema.sql
    const schemaPath = path.join(__dirname, '../../schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('Database schema migration checks completed successfully.');
    } else {
      console.warn('schema.sql not found at path:', schemaPath);
    }
    
    client.release();
  } catch (error) {
    console.error('Error connecting to database or running migration:', error);
    // Exit if there is an error to ensure failure is loud, but let's log and continue in dev if we want a fallback
  }
}
