import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DialogProvider } from "@/components/ui/dialog-provider";
import StatusBarConfig from "@/components/StatusBarConfig";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
      <body suppressHydrationWarning>
        <StatusBarConfig />
        <ThemeProvider>
          <AuthProvider>
            <DialogProvider>
              {children}
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
