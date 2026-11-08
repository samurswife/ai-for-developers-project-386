import type { MeetingType } from '@calendar/api-sdk';

/** One owner's in-memory data, shared by every application operation. */
export const calendar: {
  meetingTypes: MeetingType[];
  bookings: {
    id: string;
    meetingTypeId: string;
    startsAt: string;
    endsAt: string;
    guestName: string;
    guestEmail: string;
  }[];
} = { meetingTypes: [], bookings: [] };
