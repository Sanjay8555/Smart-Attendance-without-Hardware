const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const connStr = 'postgresql://postgres.pdvcmjqdmcysbkfzdcuv:Sanjay%4020072@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function seedSupabase() {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to Supabase PostgreSQL for seeding...');

    // 1. Password Hashes
    const adminPassHash = bcrypt.hashSync('Admin@123', 10);
    const facultyPassHash = bcrypt.hashSync('Faculty@123', 10);
    const studentPassHash = bcrypt.hashSync('Student@123', 10);

    // 2. Departments
    const deptCseId = uuidv4();
    const deptEceId = uuidv4();
    const deptItId = uuidv4();

    await client.query(`
      INSERT INTO departments (id, name, code) VALUES
        ($1, 'Computer Science & Engineering', 'CSE'),
        ($2, 'Electronics & Communication', 'ECE'),
        ($3, 'Information Technology', 'IT')
      ON CONFLICT (code) DO NOTHING;
    `, [deptCseId, deptEceId, deptItId]);

    const cseDept = (await client.query("SELECT id FROM departments WHERE code = 'CSE'")).rows[0];

    // 3. Academic Years
    const y3Id = uuidv4();
    await client.query(`
      INSERT INTO academic_years (id, year_number, label) VALUES
        ($1, 3, '3rd Year (Junior)')
      ON CONFLICT DO NOTHING;
    `, [y3Id]);

    const yr3 = (await client.query("SELECT id FROM academic_years WHERE year_number = 3")).rows[0];

    // 4. Classes
    const classCse3AId = uuidv4();
    await client.query(`
      INSERT INTO classes (id, department_id, year_id, name, code) VALUES
        ($1, $2, $3, 'CSE-3A', 'CSE-3A-2026')
      ON CONFLICT (code) DO NOTHING;
    `, [classCse3AId, cseDept.id, yr3.id]);

    const cls3a = (await client.query("SELECT id FROM classes WHERE code = 'CSE-3A-2026'")).rows[0];

    // 5. Users
    await client.query(`
      INSERT INTO users (id, email, password_hash, role, name, phone) VALUES
        ($1, 'admin@college.edu', $2, 'admin', 'Institutional Admin', '+91 98765 00001'),
        ($3, 'faculty@college.edu', $4, 'faculty', 'Prof. Rajesh Sharma', '+91 98765 00002'),
        ($5, 'alex@college.edu', $6, 'student', 'Alex Johnson', '+91 98765 50001'),
        ($7, 'priya@college.edu', $6, 'student', 'Priya Sundaram', '+91 98765 50002')
      ON CONFLICT (email) DO NOTHING;
    `, [
      uuidv4(), adminPassHash,
      uuidv4(), facultyPassHash,
      uuidv4(), studentPassHash,
      uuidv4()
    ]);

    const facUser = (await client.query("SELECT id FROM users WHERE email = 'faculty@college.edu'")).rows[0];
    const alexUser = (await client.query("SELECT id FROM users WHERE email = 'alex@college.edu'")).rows[0];
    const priyaUser = (await client.query("SELECT id FROM users WHERE email = 'priya@college.edu'")).rows[0];

    // 6. Faculty Profile
    await client.query(`
      INSERT INTO faculty_profiles (id, user_id, employee_id, department_id, designation) VALUES
        ($1, $2, 'FAC-CSE-01', $3, 'Professor & Head')
      ON CONFLICT (employee_id) DO NOTHING;
    `, [uuidv4(), facUser.id, cseDept.id]);

    const facProf = (await client.query("SELECT id FROM faculty_profiles WHERE employee_id = 'FAC-CSE-01'")).rows[0];

    // 7. Student Profiles
    await client.query(`
      INSERT INTO student_profiles (id, user_id, student_id, roll_no, class_id) VALUES
        ($1, $2, 'STU-2024-001', '22CS01', $3),
        ($4, $5, 'STU-2024-002', '22CS02', $3)
      ON CONFLICT (student_id) DO NOTHING;
    `, [uuidv4(), alexUser.id, cls3a.id, uuidv4(), priyaUser.id]);

    const alexProf = (await client.query("SELECT id FROM student_profiles WHERE student_id = 'STU-2024-001'")).rows[0];

    // 8. Face Biometrics Template
    const vec1 = [];
    for (let i = 0; i < 128; i++) vec1.push(Number(Math.sin(1 + i * 0.1).toFixed(4)));

    await client.query(`
      INSERT INTO face_templates (id, student_id, template_data, liveness_score, consent_status) VALUES
        ($1, $2, $3, 0.98, 1)
      ON CONFLICT (student_id) DO UPDATE SET template_data = $3, liveness_score = 0.98, updated_at = NOW();
    `, [uuidv4(), alexProf.id, JSON.stringify(vec1)]);

    // 9. Subject
    await client.query(`
      INSERT INTO subjects (id, code, name, department_id, semester) VALUES
        ($1, 'CS301', 'Database Management Systems', $2, 5)
      ON CONFLICT (code) DO NOTHING;
    `, [uuidv4(), cseDept.id]);

    const subj = (await client.query("SELECT id FROM subjects WHERE code = 'CS301'")).rows[0];

    // 10. Location (Geofence)
    const locId = uuidv4();
    await client.query(`
      INSERT INTO attendance_locations (id, name, latitude, longitude, radius_meters) VALUES
        ($1, 'Main Campus Academic Quad', 12.971598, 77.594562, 150)
      ON CONFLICT DO NOTHING;
    `, [locId]);

    const loc = (await client.query("SELECT id FROM attendance_locations LIMIT 1")).rows[0];

    // 11. Active Attendance Session
    const now = new Date();
    const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const lateTime = new Date(Date.now() + 30 * 60 * 1000);

    await client.query(`
      INSERT INTO attendance_sessions (
        id, faculty_id, subject_id, class_id, location_id,
        period_name, start_time, end_time, late_threshold_time, status,
        current_qr_token, qr_expires_at, current_otp_display, otp_expires_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'Period 2 (11:00 AM - 11:50 AM)', $6, $7, $8, 'active',
        'ATT_QR_LIVE_2026', $7, '482915', $7
      )
      ON CONFLICT DO NOTHING;
    `, [uuidv4(), facProf.id, subj.id, cls3a.id, loc.id, now, endTime, lateTime]);

    console.log('🎉 Supabase Database successfully seeded!');
    const uRes = await client.query('SELECT name, email, role FROM users');
    uRes.rows.forEach(u => console.log(` - User: ${u.name} (${u.email}) [${u.role}]`));

    await client.end();
  } catch (err) {
    console.error('Seeding error:', err);
    try { await client.end(); } catch (_) {}
  }
}

seedSupabase();
