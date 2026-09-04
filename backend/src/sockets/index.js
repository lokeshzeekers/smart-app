const jwt = require('jsonwebtoken');

/**
 * Rooms:
 *  - session:<sessionId>  -> trainee's phone joins this while doing Coach/Check/Certification,
 *                            receives 'step:update' and 'session:complete' live from the ESP32.
 *  - trainers              -> all connected trainers join this, receive 'review:new' pushes.
 */
function attachSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.user.role === 'trainer' || socket.user.role === 'admin') {
      socket.join('trainers');
    }

    socket.on('session:join', (sessionId) => {
      socket.join(`session:${sessionId}`);
    });

    socket.on('session:leave', (sessionId) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      // no-op, rooms are cleaned up automatically
    });
  });
}

module.exports = { attachSockets };
