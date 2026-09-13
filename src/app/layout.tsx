import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Geist_Mono, Host_Grotesk } from "next/font/google";
import { cookies } from "next/headers";

import { Toaster } from "@/components/ui/sonner";
import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";

import "./globals.css";

const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Piko",
  description: "A private, cloud-synced budgeting app for two partners",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const accentCookie = cookieStore.get(ACCENT_COLOR_COOKIE_NAME)?.value ?? "";
  const accent = isAccentColor(accentCookie) ? accentCookie : "purple";

  return (
    <html
      className={`${hostGrotesk.variable} ${geistMono.variable} h-full antialiased`}
      data-accent={accent}
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" disableTransitionOnChange enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
