const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const { Server } = require('socket.io');

const config = require('./config/config');
const { initSchema } = require('./database/db');
const { setupSocket } = require('./socket/socketHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const academicRoutes = require('./routes/academic.routes');
const usersRoutes = require('./routes/users.routes');
const locationsRoutes = require('./routes/locations.routes');
const settingsRoutes = require('./routes/settings.routes');
const sessionRoutes = require('./routes/session.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const faceRoutes = require('./routes/face.routes');
const reportsRoutes = require('./routes/reports.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const auditRoutes = require('./routes/audit.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const proxyRoutes = require('./routes/proxy.routes');

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);
setupSocket(io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Permissive for local camera / canvas / maps preview
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' })); // Allow face embedding arrays / camera descriptors
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/proxy', proxyRoutes);

// Health check & Database Status
app.get('/api/health', (req, res) => {
  const { getSupabaseHealth } = require('./database/supabaseSync');
  res.json({
    status: 'OK',
    name: 'Smart Attendance System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    supabase: getSupabaseHealth()
  });
});

// Serve frontend in production if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API endpoint ${req.method} ${req.url} not found` });
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send('Smart Attendance System Backend Running. Start the Vite client dev server to view UI.');
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'An internal server error occurred.'
  });
});

// Start Server if executed directly
if (require.main === module) {
  server.listen(config.PORT, async () => {
    console.log(`🚀 Smart Attendance Server is running on http://localhost:${config.PORT}`);
    
    // Initialize and synchronize with Supabase PostgreSQL cloud database
    try {
      const { initSupabaseConnection, syncAllToSupabase } = require('./database/supabaseSync');
      const { db } = require('./database/db');
      const connected = await initSupabaseConnection();
      if (connected) {
        syncAllToSupabase(db).catch(e => console.warn('Supabase initial sync note:', e.message));
      }
    } catch (supabaseErr) {
      console.warn('Supabase cloud init note:', supabaseErr.message);
    }
  });
}

module.exports = { app, server };

