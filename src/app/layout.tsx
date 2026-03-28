import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siglane",
  description: "Turn prompt chaos into control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-900 antialiased">{children}</body>
    </html>
  );
}
