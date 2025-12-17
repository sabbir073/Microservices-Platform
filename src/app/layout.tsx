import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EarnGPT - Earn Money Online",
    template: "%s | EarnGPT",
  },
  description: "Complete tasks, watch videos, and earn real money with EarnGPT. Join our community and start earning today!",
  keywords: ["earn money", "online earning", "tasks", "rewards", "cashout", "referral"],
  authors: [{ name: "EarnGPT Team" }],
  creator: "EarnGPT",
  publisher: "EarnGPT",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EarnGPT",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://earngpt.com",
    siteName: "EarnGPT",
    title: "EarnGPT - Earn Money Online",
    description: "Complete tasks, watch videos, and earn real money with EarnGPT.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EarnGPT - Earn Money Online",
    description: "Complete tasks, watch videos, and earn real money with EarnGPT.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="dark" storageKey="earngpt-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
