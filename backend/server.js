require('dotenv').config();

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
const errorHandler = require('./middleware/errorHandler');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/api', healthRoutes);
app.use('/api', dbRoutes);
app.use('/api', outageRoutes);
app.use('/api', componentRoutes);
app.use('/api', impactRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', recoveryRoutes);
app.use('/api', verificationRoutes);
app.use('/api', reportRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found.',
  });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
