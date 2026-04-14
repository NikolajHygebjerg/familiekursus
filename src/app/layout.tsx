import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FamilyProvider } from "@/context/FamilyContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Familiekursus - Workshop Oversigter",
  description: "Oversigt over workshop-tilmeldinger fra familiekursus",
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
            <AppShell>{children}</AppShell>
          </FamilyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
