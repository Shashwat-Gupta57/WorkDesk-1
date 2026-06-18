import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkDesk",
  description: "The knowledge archive of Flex Studios.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WorkDesk",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-surface-primary text-text-primary">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
