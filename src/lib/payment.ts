import { toPaise } from "./money";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "POST_TRAVEL" | "REFUNDED" | "PARTIAL_REFUND";

/** Derive payment status + balance from payment entries (SDD §5). */
export function derivePayment(totalPaise: number, entries: { kind: string; amount: string; voidedAt: Date | null }[], bookingStatus: string, postTravel: boolean) {
  let paid = 0, refunded = 0;
  for (const e of entries) {
    if (e.voidedAt) continue;
    if (e.kind === "PAYMENT") paid += toPaise(e.amount); else refunded += toPaise(e.amount);
  }
  const net = paid - refunded;
  let status: PaymentStatus;
  if (bookingStatus === "CANCELLED") {
    if (refunded > 0 && refunded >= paid) status = "REFUNDED";
    else if (refunded > 0) status = "PARTIAL_REFUND";
    else status = paid >= totalPaise && paid > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  } else if (net >= totalPaise) status = "PAID";
  else if (net > 0) status = "PARTIAL";
  else status = postTravel ? "POST_TRAVEL" : "UNPAID";
  const balance = bookingStatus === "CANCELLED" ? 0 : Math.max(0, totalPaise - net);
  return { paid, refunded, net, balance, status };
}

