import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DePIN Research Lab | Paying for What Matters",
  description: "Reproducible experiments for verification-aware wireless incentives.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

