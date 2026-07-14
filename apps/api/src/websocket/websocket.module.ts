import { Global, Module } from '@nestjs/common';
import { RunsGateway } from './runs.gateway';

@Global()
@Module({
  providers: [RunsGateway],
  exports: [RunsGateway],
})
export class WebSocketModule {}
