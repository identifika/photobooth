import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";

export const metadata: Metadata = {
  title: {
    template: "%s | Pika",
    default: "Pika — Capture the Moment",
  },
  description: "A premium customizable photobooth experience for capturing and sharing your favorite moments.",
  keywords: ["photobooth", "vintage photos", "photo editor", "Pika", "camera app", "customizable photobooth"],
  openGraph: {
    title: "Pika — Capture the Moment",
    description: "A premium customizable photobooth experience for capturing and sharing your favorite moments.",
    type: "website",
    siteName: "Pika Photobooth",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pika — Capture the Moment",
    description: "A premium customizable photobooth experience for capturing and sharing your favorite moments.",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
