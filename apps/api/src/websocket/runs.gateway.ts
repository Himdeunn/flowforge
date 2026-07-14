import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';

@NestWebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ws/runs',
})
@Injectable()
export class RunsGateway {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Connection handshake logic will be added in Phase 3
  }

  handleDisconnect(client: Socket) {
    // Cleanup logic
  }

  @SubscribeMessage('subscribe:run')
  handleSubscribeRun(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`run:${data.runId}`);
    return { status: 'subscribed', runId: data.runId };
  }

  @SubscribeMessage('unsubscribe:run')
  handleUnsubscribeRun(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`run:${data.runId}`);
    return { status: 'unsubscribed', runId: data.runId };
  }

  // Helper method to emit events to the run's room
  emitToRunRoom(runId: string, eventName: string, payload: any) {
    if (this.server) {
      this.server.to(`run:${runId}`).emit(eventName, payload);
    }
  }
}
