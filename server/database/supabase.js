const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || '';

let supabase = null;
let pgPool = null;

// Initialize Supabase REST Client
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  console.log('✅ Connected to Supabase REST client at:', SUPABASE_URL);
}

// Initialize Direct PostgreSQL Connection Pool (Optional / High-Performance)
if (SUPABASE_DB_URL) {
  pgPool = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('✅ Connected to Supabase PostgreSQL Connection Pool');
}

module.exports = {
  supabase,
  pgPool,
  isSupabaseConfigured: () => Boolean(supabase || pgPool)
};
