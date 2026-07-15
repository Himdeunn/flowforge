import { Test, TestingModule } from '@nestjs/testing';
import { RunsGateway } from './runs.gateway';
import { Socket, Server } from 'socket.io';

describe('RunsGateway', () => {
  let gateway: RunsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RunsGateway],
    }).compile();

    gateway = module.get<RunsGateway>(RunsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should join client to run room on subscribe:run', () => {
    const mockSocket = {
      join: jest.fn(),
    } as unknown as Socket;

    const result = gateway.handleSubscribeRun({ runId: 'run-123' }, mockSocket);

    expect(mockSocket.join).toHaveBeenCalledWith('run:run-123');
    expect(result).toEqual({ status: 'subscribed', runId: 'run-123' });
  });

  it('should leave client room on unsubscribe:run', () => {
    const mockSocket = {
      leave: jest.fn(),
    } as unknown as Socket;

    const result = gateway.handleUnsubscribeRun(
      { runId: 'run-123' },
      mockSocket,
    );

    expect(mockSocket.leave).toHaveBeenCalledWith('run:run-123');
    expect(result).toEqual({ status: 'unsubscribed', runId: 'run-123' });
  });

  it('should call server.to().emit() when emitToRunRoom is called', () => {
    const mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as Server;

    gateway.server = mockServer;
    gateway.emitToRunRoom('run-123', 'event-name', { data: true });

    expect(mockServer.to).toHaveBeenCalledWith('run:run-123');
    expect(mockServer.emit).toHaveBeenCalledWith('event-name', { data: true });
  });
});
