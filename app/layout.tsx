import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* Data/table face — tabular numerals for stage counts, scores, ageing days. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

/* Code/config views — approval-chain JSON, audit-log detail. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TalentFlow — Anwar Group",
    template: "%s · TalentFlow",
  },
  description:
    "Talent acquisition coordination for Anwar Group — one recruiter, one current stage, one next action per application.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14131a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Display (General Sans) + body/UI (Instrument Sans) via Fontshare —
            not available through next/font/google. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=instrument-sans@400,500,600&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
