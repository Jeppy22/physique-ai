import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PhysiqueAI — Contest Prep Coach",
  description: "Evidence-based AI coaching for bodybuilding contest prep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased bg-zinc-950 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
