import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { MeetingTypesController } from './meeting-types.controller.js';
import { BookingsController } from './bookings.controller.js';
import { FrontendController } from './frontend.controller.js';

@Module({
  controllers: [
    HealthController,
    MeetingTypesController,
    BookingsController,
    ...(process.env.NODE_ENV === 'production' ? [FrontendController] : []),
  ],
})
export class AppModule {}
