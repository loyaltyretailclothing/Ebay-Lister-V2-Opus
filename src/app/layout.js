import { Geist, Geist_Mono } from "next/font/google";
import AppFrame from "@/components/nav/AppFrame";
import DevWriteGuard from "@/components/dev/DevWriteGuard";
import { PhotoTransferProvider } from "@/contexts/PhotoTransferContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "eBay Lister",
  description: "AI-powered eBay listing tool",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full text-md">
        <DevWriteGuard />
        <PhotoTransferProvider>
          <AppFrame>{children}</AppFrame>
        </PhotoTransferProvider>
      </body>
    </html>
  );
}
