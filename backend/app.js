const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const healthRoutes = require('./routes/healthRoutes');
const dbRoutes = require('./routes/dbRoutes');
const outageRoutes = require('./routes/outageRoutes');
const componentRoutes = require('./routes/componentRoutes');
const impactRoutes = require('./routes/impactRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const recoveryRoutes = require('./routes/recoveryRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const errorHandler = require('./middleware/errorHandler');
const requireAuth = require('./middleware/requireAuth');

const app = express();
const allowedOrigins = (
  process.env.CORS_ORIGINS
  || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '32kb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(
  ['/api/auth/register', '/api/auth/login'],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/api', healthRoutes);
app.use('/api', dbRoutes);
app.use('/api', authRoutes);
app.use('/api', requireAuth);
app.use('/api', outageRoutes);
app.use('/api', componentRoutes);
app.use('/api', impactRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', recoveryRoutes);
app.use('/api', verificationRoutes);
app.use('/api', reportRoutes);
app.use('/api', locationRoutes);
app.use('/api', serviceRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found.',
  });
});

app.use(errorHandler);

module.exports = app;
