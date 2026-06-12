const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "https://ezshare-alpha.vercel.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "https://ezshare-alpha.vercel.app",
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.static(path.join(__dirname, '../frontend/build')));

// room ID -> sender socket ID
const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Sender registers a room with its SDP offer
  socket.on('register', ({ roomId, offer }) => {
    rooms[roomId] = { offer, senderSocket: socket.id };
    socket.join(roomId);
    console.log(`Room registered: ${roomId}`);
  });

  // Receiver joins a room and requests the offer
  socket.on('join', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    socket.join(roomId);
    socket.emit('offer', { offer: room.offer });
    console.log(`Receiver joined room: ${roomId}`);
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('candidate', { candidate });
  });

  socket.on('disconnect', () => {
    // Clean up rooms owned by this socket
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.senderSocket === socket.id) {
        delete rooms[roomId];
        console.log(`Room cleaned up: ${roomId}`);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
