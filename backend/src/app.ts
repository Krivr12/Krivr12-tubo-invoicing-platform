import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/routes.js';
import invoiceRoutes from './modules/invoices/routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(globalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(ENV.PORT, () => {
  console.log(`Tubo API server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
});

export default app;