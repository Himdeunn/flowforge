import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function subscribeToRun(
  runId: string,
  onStepChanged: (data: any) => void,
  onRunCompleted: (data: any) => void,
) {
  const s = getSocket();
  s.emit('subscribe:run', { runId });
  s.on('step:status_changed', onStepChanged);
  s.on('run:completed', onRunCompleted);
  return () => {
    s.emit('unsubscribe:run', { runId });
    s.off('step:status_changed', onStepChanged);
    s.off('run:completed', onRunCompleted);
  };
}
