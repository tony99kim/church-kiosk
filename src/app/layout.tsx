import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교회 키오스크",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
