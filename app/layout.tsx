import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photobooth — Capture the Moment",
  description: "A vintage-inspired photobooth experience",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
