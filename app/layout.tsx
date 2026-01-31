import "./globals.css";
import type { Metadata } from "next";
import ThemeScript from "@/components/ThemeScript";

export const metadata: Metadata = {
  title: "دفعتنا",
  description: "مكتبة رقمية منظمة للدفعة: مواد، ريكوردات، امتحانات، وملفات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
