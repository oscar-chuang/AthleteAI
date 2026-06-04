import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AthleteAI — AI Sports Performance Coach",
  description: "Upload training videos and get elite-level biomechanics analysis, personalized coaching, injury prevention, and pro athlete comparisons — powered by AI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "var(--bg)", minHeight: "100vh" }}>{children}</body>
    </html>
  );
}
