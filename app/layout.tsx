import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { COLOR_MODE_KEY } from "@/lib/kit/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quiet Streets · Unmap app",
  description:
    "How loud a street is, day and night, in Calgary, Edmonton, Vancouver, Toronto, Montréal and Québec City, against the WHO guideline, with up to three places side by side. Built with Unmap and the Unmap component registry. Modelled, not measured. © OpenStreetMap contributors (ODbL); noise model: PickYourPlace.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={COLOR_MODE_KEY} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
