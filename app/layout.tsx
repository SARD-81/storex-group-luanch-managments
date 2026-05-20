import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appFont } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
