import localFont from "next/font/local";

export const appFont = localFont({
  src: "./fonts/vazirmatn/Vazirmatn-VariableFont_wght.ttf",
  variable: "--font-app",
  display: "swap",
  weight: "100 900",
});