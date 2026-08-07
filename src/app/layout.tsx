import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Winddown — Wyoming Dissolution Form Preparation",
  description:
    "Prepare your Wyoming Articles of Dissolution quickly and accurately. Document preparation only, not legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
