import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { MeetingTypesController } from './meeting-types.controller.js';

@Module({
  controllers: [HealthController, MeetingTypesController],
})
export class AppModule {}
