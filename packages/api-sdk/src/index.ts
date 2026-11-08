export {
  bookingsCreateBooking,
  bookingsListUpcomingBookings,
  getHealth,
  meetingTypesGetMeetingType,
  meetingTypesGetSlots,
  meetingTypesCreateMeetingType,
  meetingTypesListMeetingTypes,
} from './generated/sdk.gen.js';
export { client } from './generated/client.gen.js';
export { createClient, createConfig } from './generated/client/index.js';
export type {
  Booking,
  Slot,
  CreateBookingRequest,
  BookingsCreateBookingResponse,
  BookingsListUpcomingBookingsResponse,
  GetHealthResponse,
  MeetingTypesGetMeetingTypeResponse,
  MeetingTypesGetSlotsResponse,
  Availability,
  HealthResponse,
  MeetingType,
  CreateMeetingTypeRequest,
  FieldError,
  MeetingTypesCreateMeetingTypeResponse,
  MeetingTypesListMeetingTypesResponse,
} from './generated/types.gen.js';
