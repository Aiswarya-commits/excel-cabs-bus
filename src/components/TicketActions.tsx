"use client";
import { useState } from "react";
export function TicketActions({ shareText, url }: { shareText: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const full = typeof window !== "undefined" ? new URL(url, location.origin).toString() : url;
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button onClick={() => window.print()} className="btn-outline">🖨 Print / Save PDF</button>
      <a className="btn-outline" target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${full}`)}`}>💬 Share on WhatsApp</a>
      <button className="btn-outline" onClick={async () => { try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? "✓ Copied" : "🔗 Copy link"}</button>
    </div>
  );
}
