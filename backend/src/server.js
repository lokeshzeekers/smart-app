require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

// Log-and-continue instead of a silent hard crash with no explanation in
// the terminal. Real bugs should still be fixed, but a stray unhandled
// rejection shouldn't take the whole backend down along with them.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection (server kept running):', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception (server kept running):', err);
});

const authRoutes = require('./routes/authRoutes');
const traineeRoutes = require('./routes/traineeRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const esp32Routes = require('./routes/esp32Routes');
const { attachSockets } = require('./sockets');

const app = express();
const server = http.createServer(app);

// Behind a reverse proxy (Caddy/nginx) every request arrives from the proxy's IP, so the
// per-IP rate limiter (e.g. 5 OTP requests / 10 min) would be shared by ALL users. Set
// TRUST_PROXY=1 (number of proxy hops in front) so the real client IP is used instead.
// Leave it unset when the backend is reached directly - otherwise clients could spoof
// X-Forwarded-For to dodge the limiter.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
});
attachSockets(io);
app.set('io', io);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'smart-airway-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/trainee', traineeRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/esp32', esp32Routes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`SMArT backend listening on port ${PORT}`);
});

module.exports = { app, server, io };
