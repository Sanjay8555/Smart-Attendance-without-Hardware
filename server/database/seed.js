const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const config = require('../config/config');

function seedDatabase() {
  console.log('🌱 Seeding Smart Attendance database...');

  // Helper to generate password hash
  const hashPassword = (password) => bcrypt.hashSync(password, 10);

  // Run in transaction
  const seedTx = db.transaction(() => {
    // 1. CLEAR EXISTING DATA FOR FRESH SEED
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM audit_logs;
      DELETE FROM face_templates;
      DELETE FROM attendance_records;
      DELETE FROM otp_sessions;
      DELETE FROM qr_tokens;
      DELETE FROM attendance_sessions;
      DELETE FROM faculty_assignments;
      DELETE FROM students;
      DELETE FROM faculty;
      DELETE FROM subjects;
      DELETE FROM sections;
      DELETE FROM classes;
      DELETE FROM academic_years;
      DELETE FROM departments;
      DELETE FROM attendance_locations;
      DELETE FROM attendance_settings;
      DELETE FROM users;
    `);

    // 2. INSERT DEFAULT ATTENDANCE SETTINGS
    const insertSetting = db.prepare(`
      INSERT INTO attendance_settings (key, value, description)
      VALUES (?, ?, ?)
    `);

    Object.entries(config.DEFAULT_RULES).forEach(([key, value]) => {
      insertSetting.run(key, value, `System rule for ${key.replace(/_/g, ' ')}`);
    });

    // 3. INSERT CAMPUS GEOFENCE LOCATIONS
    const insertLocation = db.prepare(`
      INSERT INTO attendance_locations (id, name, latitude, longitude, radius_meters, is_active, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const loc1Id = uuidv4();
    const loc2Id = uuidv4();
    const loc3Id = uuidv4();

    insertLocation.run(
      loc1Id,
      'Apex Main Campus Academic Quad',
      12.971598,
      77.594562,
      150.0,
      1,
      'Central engineering lecture halls, Computer Labs 1-4, Main Quad'
    );
    insertLocation.run(
      loc2Id,
      'Block B - IT & Computing Complex',
      12.972100,
      77.595200,
      100.0,
      1,
      'Information Technology & Artificial Intelligence seminar halls'
    );
    insertLocation.run(
      loc3Id,
      'Innovation Center & Library',
      12.970800,
      77.593900,
      120.0,
      1,
      'Auditorium, Digital Library and Research Labs'
    );

    // 4. INSERT DEPARTMENTS
    const insertDept = db.prepare(`
      INSERT INTO departments (id, code, name)
      VALUES (?, ?, ?)
    `);
    const deptCSE = uuidv4();
    const deptIT = uuidv4();
    const deptECE = uuidv4();
    const deptAI = uuidv4();

    insertDept.run(deptCSE, 'CSE', 'Computer Science & Engineering');
    insertDept.run(deptIT, 'IT', 'Information Technology');
    insertDept.run(deptECE, 'ECE', 'Electronics & Communication Engineering');
    insertDept.run(deptAI, 'AIDS', 'Artificial Intelligence & Data Science');

    // 5. INSERT ACADEMIC YEARS
    const insertYear = db.prepare(`
      INSERT INTO academic_years (id, year_number, label)
      VALUES (?, ?, ?)
    `);
    const year1 = uuidv4();
    const year2 = uuidv4();
    const year3 = uuidv4();
    const year4 = uuidv4();

    insertYear.run(year1, 1, '1st Year (Freshman)');
    insertYear.run(year2, 2, '2nd Year (Sophomore)');
    insertYear.run(year3, 3, '3rd Year (Junior)');
    insertYear.run(year4, 4, '4th Year (Senior)');

    // 6. INSERT CLASSES
    const insertClass = db.prepare(`
      INSERT INTO classes (id, department_id, year_id, name, code)
      VALUES (?, ?, ?, ?, ?)
    `);
    const classCSEA = uuidv4();
    const classCSEB = uuidv4();
    const classITA = uuidv4();
    const classAIA = uuidv4();

    insertClass.run(classCSEA, deptCSE, year3, 'CSE-3A', 'CSE-3A');
    insertClass.run(classCSEB, deptCSE, year3, 'CSE-3B', 'CSE-3B');
    insertClass.run(classITA, deptIT, year2, 'IT-2A', 'IT-2A');
    insertClass.run(classAIA, deptAI, year3, 'AI-3A', 'AI-3A');

    // 7. INSERT SECTIONS
    const insertSection = db.prepare(`
      INSERT INTO sections (id, class_id, name)
      VALUES (?, ?, ?)
    `);
    const secA1 = uuidv4();
    const secA2 = uuidv4();
    const secIT1 = uuidv4();

    insertSection.run(secA1, classCSEA, 'Section 1');
    insertSection.run(secA2, classCSEA, 'Section 2');
    insertSection.run(secIT1, classITA, 'Section 1');

    // 8. INSERT SUBJECTS
    const insertSubject = db.prepare(`
      INSERT INTO subjects (id, code, name, department_id, semester, credits)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const subDBMS = uuidv4();
    const subCN = uuidv4();
    const subOS = uuidv4();
    const subAI = uuidv4();
    const subDS = uuidv4();

    insertSubject.run(subDBMS, 'CS301', 'Database Management Systems', deptCSE, 5, 4);
    insertSubject.run(subCN, 'CS302', 'Computer Networks & Security', deptCSE, 5, 4);
    insertSubject.run(subOS, 'CS303', 'Operating Systems', deptCSE, 5, 3);
    insertSubject.run(subAI, 'AI301', 'Artificial Intelligence & Neural Nets', deptAI, 5, 4);
    insertSubject.run(subDS, 'IT201', 'Data Structures & Algorithms', deptIT, 3, 4);

    // 9. INSERT USERS (ADMIN, FACULTY, STUDENTS)
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // --- ADMIN ---
    const adminUserId = uuidv4();
    insertUser.run(
      adminUserId,
      'Dr. Vikram Malhotra (Dean)',
      'admin@college.edu',
      hashPassword('Admin@123'),
      'admin',
      'active'
    );

    // --- FACULTY ---
    const insertFaculty = db.prepare(`
      INSERT INTO faculty (id, user_id, faculty_id, department_id, designation, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const fac1UserId = uuidv4();
    const fac1Id = uuidv4();
    insertUser.run(fac1UserId, 'Prof. Rajesh Sharma', 'faculty.sharma@college.edu', hashPassword('Faculty@123'), 'faculty', 'active');
    insertFaculty.run(fac1Id, fac1UserId, 'FAC-CSE-01', deptCSE, 'Professor & Head', '+91 98765 43210');

    const fac2UserId = uuidv4();
    const fac2Id = uuidv4();
    insertUser.run(fac2UserId, 'Dr. Meera Patel', 'faculty.patel@college.edu', hashPassword('Faculty@123'), 'faculty', 'active');
    insertFaculty.run(fac2Id, fac2UserId, 'FAC-IT-02', deptIT, 'Associate Professor', '+91 98765 43211');

    const fac3UserId = uuidv4();
    const fac3Id = uuidv4();
    insertUser.run(fac3UserId, 'Prof. Amit Verma', 'faculty.verma@college.edu', hashPassword('Faculty@123'), 'faculty', 'active');
    insertFaculty.run(fac3Id, fac3UserId, 'FAC-AI-03', deptAI, 'Assistant Professor', '+91 98765 43212');

    // FACULTY ASSIGNMENTS
    const insertAssignment = db.prepare(`
      INSERT INTO faculty_assignments (id, faculty_id, subject_id, class_id, section_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAssignment.run(uuidv4(), fac1Id, subDBMS, classCSEA, secA1);
    insertAssignment.run(uuidv4(), fac1Id, subOS, classCSEA, secA1);
    insertAssignment.run(uuidv4(), fac2Id, subCN, classCSEA, secA1);
    insertAssignment.run(uuidv4(), fac2Id, subDS, classITA, secIT1);
    insertAssignment.run(uuidv4(), fac3Id, subAI, classAIA, null);

    // --- STUDENTS ---
    const insertStudent = db.prepare(`
      INSERT INTO students (id, user_id, student_id, roll_no, department_id, year_id, class_id, section_id, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFaceTemplate = db.prepare(`
      INSERT INTO face_templates (id, student_id, template_data, liveness_score, consent_status)
      VALUES (?, ?, ?, ?, 1)
    `);

    // Helper to generate a dummy 128-dim normalized embedding array
    const generateSampleEmbedding = (seed) => {
      const arr = [];
      for (let i = 0; i < 128; i++) {
        arr.push(Number(Math.sin(seed + i * 0.1).toFixed(4)));
      }
      return JSON.stringify(arr);
    };

    const studentsData = [
      { name: 'Alex Johnson', email: 'alex@college.edu', code: 'STU-2024-001', roll: '22CS01', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Priya Sundaram', email: 'priya@college.edu', code: 'STU-2024-002', roll: '22CS02', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Rahul Mehta', email: 'rahul@college.edu', code: 'STU-2024-003', roll: '22CS03', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Ananya Desai', email: 'ananya@college.edu', code: 'STU-2024-004', roll: '22CS04', classId: classCSEA, deptId: deptCSE, enrollFace: false },
      { name: 'Sneha Reddy', email: 'sneha@college.edu', code: 'STU-2024-005', roll: '22CS05', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Rohit Verma', email: 'rohit@college.edu', code: 'STU-2024-006', roll: '22CS06', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Neha Gupta', email: 'neha@college.edu', code: 'STU-2024-007', roll: '22CS07', classId: classCSEA, deptId: deptCSE, enrollFace: false },
      { name: 'Karan Singh', email: 'karan@college.edu', code: 'STU-2024-008', roll: '22CS08', classId: classCSEA, deptId: deptCSE, enrollFace: true },
      { name: 'Divya Nair', email: 'divya@college.edu', code: 'STU-2024-009', roll: '22IT01', classId: classITA, deptId: deptIT, enrollFace: true },
      { name: 'Manish Kumar', email: 'manish@college.edu', code: 'STU-2024-010', roll: '22IT02', classId: classITA, deptId: deptIT, enrollFace: false },
    ];

    const studentRecords = [];

    studentsData.forEach((s, idx) => {
      const uId = uuidv4();
      const sId = uuidv4();
      insertUser.run(uId, s.name, s.email, hashPassword('Student@123'), 'student', 'active');
      insertStudent.run(sId, uId, s.code, s.roll, s.deptId, year3, s.classId, secA1, `+91 98765 5000${idx}`);

      if (s.enrollFace) {
        insertFaceTemplate.run(uuidv4(), sId, generateSampleEmbedding(idx + 1), 0.98);
      }

      studentRecords.push({ studentId: sId, userId: uId, name: s.name, email: s.email, classId: s.classId });
    });

    // 10. GENERATE HISTORICAL ATTENDANCE SESSIONS & ATTENDANCE RECORDS (Past 14 Days)
    const insertSession = db.prepare(`
      INSERT INTO attendance_sessions (
        id, faculty_id, subject_id, class_id, section_id, location_id,
        attendance_mode, allow_face_fallback, period_name, start_time, end_time,
        late_threshold_time, status, current_otp_hash, current_otp_display, otp_expires_at,
        current_qr_token, qr_expires_at, total_expected, total_present, total_late, total_absent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecord = db.prepare(`
      INSERT INTO attendance_records (
        id, student_id, session_id, status, timestamp, verification_method,
        gps_lat, gps_lng, gps_distance_meters, ip_address, device_info, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const subjectsList = [
      { id: subDBMS, facId: fac1Id, name: 'DBMS' },
      { id: subCN, facId: fac2Id, name: 'CN' },
      { id: subOS, facId: fac1Id, name: 'OS' },
    ];

    const cseStudents = studentRecords.filter(s => s.classId === classCSEA);
    const now = new Date();

    // Create 12 historical sessions across the past 14 days
    for (let day = 14; day >= 1; day--) {
      const sessionDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      sessionDate.setHours(10, 0, 0, 0);

      const subObj = subjectsList[day % subjectsList.length];
      const sessId = uuidv4();
      const startTime = sessionDate.toISOString();
      const endTime = new Date(sessionDate.getTime() + 50 * 60 * 1000).toISOString();
      const lateTime = new Date(sessionDate.getTime() + 15 * 60 * 1000).toISOString();

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      insertSession.run(
        sessId,
        subObj.facId,
        subObj.id,
        classCSEA,
        secA1,
        loc1Id,
        'qr_otp',
        1,
        `Period ${(day % 5) + 1}`,
        startTime,
        endTime,
        lateTime,
        'closed',
        bcrypt.hashSync('654321', 10),
        '654321',
        endTime,
        'QR_HISTORY_' + day,
        endTime,
        cseStudents.length,
        0, // will update below
        0,
        0,
        startTime
      );

      cseStudents.forEach((stud, sIdx) => {
        // Deterministic attendance profile for each student
        // Alex has 95% attendance, Priya 90%, Rahul 70% (low attendance flag!), Sneha 85%, Rohit 60% (critical low!)
        let isPresent = true;
        let isLate = false;

        if (stud.name === 'Alex Johnson') {
          isPresent = day !== 7; // Only missed 1 day
          isLate = day === 3;
        } else if (stud.name === 'Priya Sundaram') {
          isPresent = day !== 4 && day !== 11;
          isLate = day === 2;
        } else if (stud.name === 'Rahul Mehta') {
          // Low attendance (<75%)
          isPresent = day % 2 === 0;
          isLate = day % 4 === 0;
        } else if (stud.name === 'Rohit Verma') {
          // Critical low (<60%)
          isPresent = day % 3 === 0;
        } else {
          isPresent = (day + sIdx) % 5 !== 0;
          isLate = (day + sIdx) % 4 === 0;
        }

        if (isPresent) {
          const recId = uuidv4();
          const recStatus = isLate ? 'late' : 'present';
          const recMethod = (sIdx % 3 === 0) ? 'face_gps_otp' : 'qr_gps_otp';
          const recTime = new Date(sessionDate.getTime() + (isLate ? 18 : 5) * 60 * 1000).toISOString();
          const gpsDist = Number((25 + (sIdx * 7.5)).toFixed(1));

          insertRecord.run(
            recId,
            stud.studentId,
            sessId,
            recStatus,
            recTime,
            recMethod,
            12.971620,
            77.594580,
            gpsDist,
            '192.168.1.' + (100 + sIdx),
            'Mobile/Chrome Web (Verified)',
            recTime
          );

          if (recStatus === 'present') presentCount++;
          else lateCount++;
        } else {
          absentCount++;
        }
      });

      // Update actual counts
      db.prepare(`
        UPDATE attendance_sessions
        SET total_present = ?, total_late = ?, total_absent = ?
        WHERE id = ?
      `).run(presentCount, lateCount, absentCount, sessId);
    }

    // 11. CREATE ONE LIVE ACTIVE ATTENDANCE SESSION FOR TESTING TODAY!
    const activeSessId = uuidv4();
    const activeStart = new Date();
    const activeEnd = new Date(activeStart.getTime() + 45 * 60 * 1000);
    const activeLate = new Date(activeStart.getTime() + 15 * 60 * 1000);
    const liveOtp = '482915';
    const liveToken = 'QR_LIVE_' + uuidv4().substring(0, 8).toUpperCase();

    insertSession.run(
      activeSessId,
      fac1Id,
      subDBMS,
      classCSEA,
      secA1,
      loc1Id,
      'qr_otp',
      1,
      'Period 2 (11:00 AM - 11:50 AM)',
      activeStart.toISOString(),
      activeEnd.toISOString(),
      activeLate.toISOString(),
      'active',
      bcrypt.hashSync(liveOtp, 10),
      liveOtp,
      new Date(activeStart.getTime() + 10 * 60 * 1000).toISOString(),
      liveToken,
      new Date(activeStart.getTime() + 20 * 1000).toISOString(),
      cseStudents.length,
      2, // Alex and Priya already checked in
      0,
      cseStudents.length - 2,
      activeStart.toISOString()
    );

    // Store the active QR Token
    db.prepare(`
      INSERT INTO qr_tokens (id, session_id, token, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      uuidv4(),
      activeSessId,
      liveToken,
      new Date(activeStart.getTime() + 20 * 1000).toISOString()
    );

    // Pre-mark 2 students in active session
    insertRecord.run(
      uuidv4(),
      cseStudents[0].studentId, // Alex
      activeSessId,
      'present',
      new Date().toISOString(),
      'qr_gps_otp',
      12.971600,
      77.594570,
      12.4,
      '192.168.1.101',
      'Android / Chrome 122',
      new Date().toISOString()
    );

    insertRecord.run(
      uuidv4(),
      cseStudents[1].studentId, // Priya
      activeSessId,
      'present',
      new Date().toISOString(),
      'face_gps_otp',
      12.971610,
      77.594565,
      18.2,
      '192.168.1.102',
      'iOS / Safari 17',
      new Date().toISOString()
    );

    // 12. INSERT AUDIT LOGS & MISUSE SECURITY ALERTS
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_role, user_name, action, severity, session_id, ip_address, description, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAudit.run(
      uuidv4(),
      adminUserId,
      'admin',
      'Dr. Vikram Malhotra',
      'SYSTEM_INIT',
      'info',
      null,
      '127.0.0.1',
      'Smart Attendance system initialized and security policies configured',
      JSON.stringify({ geofence_radius: '150m', min_attendance: '75%' }),
      new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString()
    );

    insertAudit.run(
      uuidv4(),
      fac1UserId,
      'faculty',
      'Prof. Rajesh Sharma',
      'SESSION_STARTED',
      'info',
      activeSessId,
      '192.168.1.45',
      'Started live attendance session for DBMS (Class CSE-3A)',
      JSON.stringify({ mode: 'qr_otp', allow_fallback: true }),
      activeStart.toISOString()
    );

    insertAudit.run(
      uuidv4(),
      studentRecords[2].userId,
      'student',
      'Rahul Mehta',
      'GPS_OUT_OF_BOUNDS',
      'warning',
      activeSessId,
      '192.168.1.189',
      'GPS Verification Failed: Student was 420m away from authorized campus geofence (Max allowed: 150m)',
      JSON.stringify({ student_distance: '420m', allowed_radius: '150m' }),
      new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    );

    insertAudit.run(
      uuidv4(),
      studentRecords[3].userId,
      'student',
      'Ananya Desai',
      'INVALID_OTP_ATTEMPT',
      'warning',
      activeSessId,
      '192.168.1.192',
      'Incorrect OTP entered during verification check',
      JSON.stringify({ attempt: 1, max_allowed: 5 }),
      new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    );

    // 13. NOTIFICATIONS
    const insertNotif = db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    studentRecords.forEach((s) => {
      insertNotif.run(
        uuidv4(),
        s.userId,
        'Live Attendance Active!',
        'Prof. Rajesh Sharma has opened attendance for Database Management Systems (CS301).',
        'info',
        '/student/active'
      );
    });

    insertNotif.run(
      uuidv4(),
      adminUserId,
      'Security Alert: Geofence Breach Blocked',
      'A student attempt from outside the 150m geofence was safely intercepted and blocked.',
      'warning',
      '/admin/audit'
    );
  });

  seedTx();
  console.log('✅ Seed completed successfully with realistic sample data!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
