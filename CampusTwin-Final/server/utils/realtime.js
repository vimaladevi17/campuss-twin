// Realtime hook. realtime/socket.js attaches Socket.IO through setIO(); without it emit() is a safe no-op
// (unit tests, scripts). Events with no explicit room go only to authenticated sockets (room "auth").
let io = null;
module.exports = {
  setIO: (instance) => { io = instance; },
  getIO: () => io,
  emit(event, payload = {}, room = "auth") {
    if (!io) return;
    io.to(room).emit(event, payload);
  },
};
