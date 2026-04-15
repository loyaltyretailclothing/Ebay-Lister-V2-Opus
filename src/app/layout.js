import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import BottomNav from "@/components/BottomNav";
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
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <PhotoTransferProvider>
          <Nav />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <BottomNav />
        </PhotoTransferProvider>
      </body>
    </html>
  );
}
