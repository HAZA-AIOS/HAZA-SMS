import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Mentor School | Education for Life",
  description: "A modern, bag-free school in Adda Machiwal, Vehari—combining strong values, personal attention and international-standard learning.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
