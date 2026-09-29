const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { supabase, pgPool, isSupabaseConfigured } = require('./supabase');
require('dotenv').config();

async function runSupabaseSeed() {
  if (!isSupabaseConfigured()) {
    console.log('⚠️ Supabase credentials not found in .env. Please configure SUPABASE_URL & keys.');
    return;
  }

  console.log('🚀 Seeding Supabase Database...');

  try {
    if (supabase) {
      // 1. Check departments
      const { data: deptData, error: deptErr } = await supabase.from('departments').select('*').limit(1);
      if (deptErr) {
        console.error('Error querying Supabase tables:', deptErr.message);
        console.log('💡 Tip: Run supabase_schema.sql in your Supabase SQL Editor first.');
        return;
      }

      console.log('✅ Supabase connection verified. Tables accessible.');
    }
  } catch (err) {
    console.error('Supabase seed error:', err);
  }
}

if (require.main === module) {
  runSupabaseSeed();
}

module.exports = { runSupabaseSeed };
