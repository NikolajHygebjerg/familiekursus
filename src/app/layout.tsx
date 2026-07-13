import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FamilyProvider } from "@/context/FamilyContext";
import AppShell from "@/components/AppShell";
import CastScriptLoader from "@/components/CastScriptLoader";

export const metadata: Metadata = {
  title: "Familiekursus",
  description: "Workshopoversigt og program for familiekursus på Brandbjerg",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Familiekursus",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  themeColor: "#dc8636",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-slate-50 antialiased">
        <AuthProvider>
          <FamilyProvider>
            <CastScriptLoader />
            <AppShell>{children}</AppShell>
          </FamilyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
