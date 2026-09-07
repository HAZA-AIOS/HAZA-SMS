import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Mentor School | Education for Life",
  description: "A modern, bag-free school in Adda Machiwal, Vehari—combining strong values, personal attention and international-standard learning.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/tms-original-logo-transparent.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/tms-original-logo-transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-tms-gold-200 selection:text-tms-navy-950">{children}</body>
    </html>
  );
}
