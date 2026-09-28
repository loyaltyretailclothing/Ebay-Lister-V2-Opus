import { Geist, Geist_Mono } from "next/font/google";
import AppFrame from "@/components/nav/AppFrame";
import DevWriteGuard from "@/components/dev/DevWriteGuard";
import PhotoSweeper from "@/components/photos/PhotoSweeper";
import BatchCollector from "@/components/photos/BatchCollector";
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
        <PhotoSweeper />
        <BatchCollector />
        <PhotoTransferProvider>
          <AppFrame>{children}</AppFrame>
        </PhotoTransferProvider>
      </body>
    </html>
  );
}
