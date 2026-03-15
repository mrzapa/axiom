import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SetupGuard } from "@/components/setup-guard";

export const metadata: Metadata = {
  title: "Axiom",
  description: "Local-first RAG application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TooltipProvider>
          <SetupGuard>{children}</SetupGuard>
        </TooltipProvider>
      </body>
    </html>
  );
}
