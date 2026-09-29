const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connStr = 'postgresql://postgres.pdvcmjqdmcysbkfzdcuv:Sanjay%4020072@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function migrateSupabase() {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected successfully to Supabase (PostgreSQL 17.6)!');

    const sqlPath = path.join(__dirname, '..', 'supabase_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing database schema and seed data...');
    await client.query(sql);
    console.log('✓ All tables, constraints, functions, and seed data created in Supabase!');

    // Verify tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\n📊 Tables created in Supabase:');
    tablesRes.rows.forEach(r => console.log(' - ' + r.table_name));

    // Verify user count
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('\n👥 Seeded Users count in Supabase:', usersCount.rows[0].count);

    await client.end();
  } catch (err) {
    console.error('Migration error:', err);
    try { await client.end(); } catch (_) {}
  }
}

migrateSupabase();
