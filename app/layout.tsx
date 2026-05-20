import type { Metadata } from "next";
import { appFont } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "داشبورد وعده‌های غذایی",
  description: "داشبورد ساده مدیریت حضور صبحانه و ناهار تیم",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={`${appFont.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}