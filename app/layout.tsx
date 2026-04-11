import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Journal",
  description: "Professional trading journal and analytics",
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
