import type { MeetingType } from '@calendar/api-sdk';

/** One owner's in-memory data, shared by every application operation. */
export const calendar: {
  meetingTypes: MeetingType[];
  bookings: { startsAt: string; endsAt: string }[];
} = { meetingTypes: [], bookings: [] };
