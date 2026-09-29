import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('⚡ Socket disconnected');
    });
  }
  return socketInstance;
}

export function joinSessionRoom(sessionId) {
  const socket = getSocket();
  socket.emit('JOIN_SESSION', sessionId);
}

export function leaveSessionRoom(sessionId) {
  const socket = getSocket();
  socket.emit('LEAVE_SESSION', sessionId);
}

export function joinUserRoom(userId) {
  const socket = getSocket();
  socket.emit('JOIN_USER', userId);
}
