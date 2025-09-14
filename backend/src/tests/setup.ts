import dotenv from 'dotenv';
import path from 'path';
import nock from 'nock';

// Ensure test environment
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Load environment variables from .env (fallback to .env.test if present)
const envPath = path.resolve(__dirname, '../../.env');
const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envPath });
dotenv.config({ path: envTestPath });

// Provide safe defaults for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Standardize on MySQL for tests; ensure required discrete vars.
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_NAME = process.env.DB_NAME || 'leadflow_ai_test';

// Block real outbound network; allow localhost for Supertest and DB
nock.disableNetConnect();
nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);
