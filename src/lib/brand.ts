// ─────────────────────────────────────────────────────────────
//  BRAND CONFIG — edit this file to match Excel Cabs exactly.
//  Logo: replace /public/logo.svg (or add logo.png and change `logo`).
//  Colours: edit the CSS variables at the top of src/app/globals.css.
// ─────────────────────────────────────────────────────────────
export const brand = {
  name: "Excel Cabs",
  product: "Excel Cabs Bus",
  tagline: "Local buses, booked in seconds.",
  logo: "/logo-mark.png",  
  website: "https://www.excelcabs.com",
  // TODO: replace with real contact details
  phone: "+91 90000 00000",
  whatsapp: "919000000000", // international format, digits only
  email: "support@excelcabs.com",
  address: "Excel Cabs, Main Road, Your City",
  supportHours: "6:00 AM – 10:00 PM, all days",
  upiId: "excelcabs@upi", // shown on ticket for manual UPI payment
    themeColor: "#b81010",
  currency: "INR",
  // Booking policy (confirm with operator — SDD §17)
  onlineAutoConfirm: false, // false = online bookings start as PENDING until staff confirm
  maxPassengersPerBooking: 10,
  bookingCutoffMinutes: 15, // stop online booking N minutes before departure
  cancellationPolicy: [
    "Free cancellation up to 6 hours before departure.",
    "50% refund between 6 hours and 1 hour before departure.",
    "No refund within 1 hour of departure or for no-shows.",
  ],
};
export type Brand = typeof brand;
