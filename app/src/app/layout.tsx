import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fluppy",
  description: "Zero-Knowledge powered payments on Stellar",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", inter.variable, geistMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#0e0f0c",
              border: "1px solid rgba(14, 15, 12, 0.1)",
              borderRadius: "1rem",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "#9fe870", secondary: "#163300" } },
            error: { iconTheme: { primary: "#f87171", secondary: "#ffffff" } },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}