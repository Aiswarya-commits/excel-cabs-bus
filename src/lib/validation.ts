import { z } from "zod";

/** Normalise Indian mobile numbers to 10 digits (accepts +91 / 0 prefixes, spaces, dashes). */
export function normalisePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
export const phone = z.string().trim().transform(normalisePhone)
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
const moneyStr = z.union([z.string(), z.number()]).transform((v) => String(v).trim())
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), "Enter a valid amount (max 2 decimals)");
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24h)");
const optText = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const passengerInput = z.object({
  name: z.string().trim().min(2, "Passenger name is required").max(80),
  age: z.coerce.number().int().min(0).max(120).optional().nullable(),
  gender: z.enum(["M", "F", "O"]).optional().nullable(),
  seatNumber: z.string().trim().max(5).optional().nullable().transform((v) => v || null),
});

export const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  contactName: z.string().trim().min(2, "Contact name is required").max(80),
  contactPhone: phone,
  contactEmail: z.string().trim().email().optional().nullable().or(z.literal("")).transform((v) => v || null),
  passengers: z.array(passengerInput).min(1, "Add at least one passenger").max(20),
  boardingStopId: z.string().uuid().optional().nullable(),
  dropStopId: z.string().uuid().optional().nullable(),
  notes: optText(500),
  // staff-only fields (ignored for public requests)
  source: z.enum(["ONLINE", "WHATSAPP", "PHONE", "COUNTER"]).optional(),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  postTravel: z.boolean().optional(),
  farePerPassenger: moneyStr.optional().nullable(),
  initialPayment: z.object({
    amount: moneyStr, method: z.enum(["UPI", "CASH", "BANK", "OTHER"]), txnReference: optText(100),
  }).optional().nullable(),
  allowDuplicate: z.boolean().optional(),
  website: z.string().optional(), // honeypot — must be empty
});

export const updateBookingSchema = z.object({
  contactName: z.string().trim().min(2).max(80).optional(),
  contactPhone: phone.optional(),
  contactEmail: z.string().trim().email().optional().nullable().or(z.literal("")).transform((v) => v || null),
  boardingStopId: z.string().uuid().optional().nullable(),
  dropStopId: z.string().uuid().optional().nullable(),
  notes: optText(500),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"]).optional(),
  postTravel: z.boolean().optional(),
  passengers: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(80).optional(), age: z.coerce.number().int().min(0).max(120).optional().nullable(), seatNumber: z.string().trim().max(5).optional().nullable() })).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(3, "Cancellation reason is required").max(300),
  refundAmount: moneyStr.optional().default("0"),
  refundStatus: z.enum(["NONE", "PENDING", "PARTIAL", "REFUNDED"]).optional().default("NONE"),
  refundMethod: z.enum(["UPI", "CASH", "BANK", "OTHER"]).optional(),
});

export const paymentSchema = z.object({
  kind: z.enum(["PAYMENT", "REFUND"]).default("PAYMENT"),
  amount: moneyStr.refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  method: z.enum(["UPI", "CASH", "BANK", "OTHER"]),
  txnReference: optText(100),
  note: optText(300),
  receivedAt: z.string().datetime({ offset: true }).optional(),
});
export const voidPaymentSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const busSchema = z.object({
  name: z.string().trim().min(2).max(80),
  registration: z.string().trim().toUpperCase().min(4).max(20),
  capacity: z.coerce.number().int().min(1).max(80),
  type: z.string().trim().min(2).max(40),
  seatLayout: z.enum(["2+2", "2+1"]).nullable().optional(),
  amenities: z.array(z.string().trim().max(30)).max(15).optional(),
  active: z.boolean().optional(),
});

export const routeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  origin: z.string().trim().min(2).max(60),
  destination: z.string().trim().min(2).max(60),
  distanceKm: z.coerce.number().int().min(0).max(5000).optional().nullable(),
  active: z.boolean().optional(),
  stops: z.array(z.object({
    name: z.string().trim().min(2).max(60),
    landmark: optText(100),
    offsetMinutes: z.coerce.number().int().min(0).max(48 * 60),
    isBoarding: z.boolean().default(true),
    isDropoff: z.boolean().default(true),
  })).min(2, "A route needs at least 2 stops (origin and destination)"),
});

export const tripSchema = z.object({
  routeId: z.string().uuid(),
  busId: z.string().uuid(),
  travelDate: dateStr,
  departureTime: timeStr,
  arrivalTime: timeStr,
  fare: moneyStr,
  status: z.enum(["SCHEDULED", "OPEN", "COMPLETED", "CANCELLED"]).default("OPEN"),
  capacityOverride: z.coerce.number().int().min(1).max(100).optional().nullable(),
  notes: optText(300),
  repeatDays: z.coerce.number().int().min(1).max(90).default(1), // bulk-create a schedule
});
export const tripUpdateSchema = tripSchema.omit({ repeatDays: true }).partial();

export const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["ADMIN", "STAFF", "TRIP_STAFF"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});
export const userUpdateSchema = userSchema.partial().extend({ active: z.boolean().optional() });
