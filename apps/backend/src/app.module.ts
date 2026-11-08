import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { MeetingTypesController } from './meeting-types.controller.js';
import { BookingsController } from './bookings.controller.js';

@Module({
  controllers: [HealthController, MeetingTypesController, BookingsController],
})
export class AppModule {}
