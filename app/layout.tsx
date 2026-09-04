import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/primitives/sonner";
import { TooltipProvider } from "@/components/ui/primitives/tooltip";
import "./globals.css";

/**
 * Both faces self-hosted through `next/font` (DESIGN.md > Typography). No
 * third-party font request: nothing render-blocking, nothing that can shift
 * layout, nothing that leaks a page view to a CDN.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* Every numeral compared against another numeral: due dates, ageing days,
   stage indices, counts, file sizes. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Anwar AI ProjectFlow",
    template: "%s · ProjectFlow",
  },
  description:
    "Project governance for Anwar Group's AI and software initiatives: one owner, one current stage, one next action per project.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          {/* Action feedback for mutations that otherwise complete silently. */}
          <Toaster position="bottom-right" closeButton richColors={false} />
        </ThemeProvider>
      </body>
    </html>
  );
}
