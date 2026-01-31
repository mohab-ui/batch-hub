import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دفعتنا Hub",
  description: "مكتبة رقمية منظمة للدفعة: مواد، ريكوردات، امتحانات، وملفات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
