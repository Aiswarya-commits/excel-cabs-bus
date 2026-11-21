import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${brand.name} — Book Local Bus Tickets`, template: `%s · ${brand.name}` },
  description: `${brand.tagline} Search trips, pick your seat and book in under a minute — no login needed.`,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo-mark.png", apple: "/logo-mark.png" },  
  appleWebApp: { capable: true, title: "Excel Bus", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: brand.themeColor, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }} />
      </body>
    </html>
  );
}
