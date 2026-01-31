import "./globals.css";
import type { Metadata } from "next";

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
    <html lang="ar" dir="rtl" className="dark">
      <head>
        {/* يمنع Flash / يحط الثيم الصح قبل ما React يشتغل */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var shouldDark = saved ? (saved === "dark") : prefersDark;
    if (shouldDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  } catch (e) {}
})();
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
