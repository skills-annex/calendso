import { Attendee, Booking, BookingStatus } from "@prisma/client";

export type BookingConfirmBody = {
  confirmed: boolean;
  id: number;
};

export type BookingCreateBody = {
  email: string;
  end: string;
  eventTypeId: number;
  guests?: string[];
  location: string;
  name: string;
  notes?: string;
  rescheduleUid?: string;
  start: string;
  timeZone: string;
  user?: string | string[];
  language: string;
  customInputs: { label: string; value: string }[];
  metadata: {
    [key: string]: string;
  };
  status?: BookingStatus;
};

export type BookingResponse = Booking & {
  paymentUid?: string;
  attendees: Attendee[];
};
