import type { Metadata } from "next";
import { Suspense } from "react";
import { appFont } from "./fonts";
import ToastQueryMessages from "@/components/feedback/toast-query-messages";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
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
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors closeButton dir="rtl" />
          <Suspense fallback={null}>
            <ToastQueryMessages />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
