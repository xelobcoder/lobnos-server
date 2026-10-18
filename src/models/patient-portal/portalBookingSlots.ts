export interface BookingSlot {
     time: string;
     booked: number;
     capacity: number;
     available: boolean;
}

export const MAX_BOOKING_DAYS_AHEAD = 60;
/** Patients cannot book a slot starting sooner than this, so staff have time to prepare. */
export const BOOKING_LEAD_MINUTES = 60;

export const localDateIso = (date = new Date()) =>
     new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Accepts a real calendar date from today up to MAX_BOOKING_DAYS_AHEAD days ahead. */
export function isBookableDate(value: unknown, now = new Date()): value is string {
     if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
     const parsed = new Date(`${value}T00:00:00`);
     if (isNaN(parsed.getTime()) || localDateIso(parsed) !== value) return false;
     const today = localDateIso(now);
     const last = localDateIso(new Date(now.getTime() + MAX_BOOKING_DAYS_AHEAD * 86_400_000));
     return value >= today && value <= last;
}

/**
 * Hourly slots between the facility's booking hours. `booked` maps an hour (0-23) to existing
 * bookings; a slot is available when it has spare capacity and starts after the lead time.
 */
export function bookingSlots(date: string, startHour: number, endHour: number, capacity: number,
     booked: Map<number, number>, now = new Date()): BookingSlot[] {
     const slots: BookingSlot[] = [];
     const earliest = now.getTime() + BOOKING_LEAD_MINUTES * 60_000;
     for (let hour = startHour; hour < endHour; hour++) {
          const time = `${String(hour).padStart(2, '0')}:00`;
          const count = booked.get(hour) || 0;
          const starts = new Date(`${date}T${time}:00`).getTime();
          slots.push({ time, booked: count, capacity, available: count < capacity && starts >= earliest });
     }
     return slots;
}

/** Parses an "HH:00" slot time into its hour, or null when it is not an hourly slot. */
export function slotHour(value: unknown): number | null {
     const match = String(value || '').match(/^([01]\d|2[0-3]):00$/);
     return match ? Number(match[1]) : null;
}
