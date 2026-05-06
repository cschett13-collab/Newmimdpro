import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "One Stop Handy Man LLC — Trusted Home Repairs & Improvements",
  description:
    "One Stop Handy Man LLC handles every job around your home — from quick repairs to full remodels. Licensed, insured, and locally owned.",
  openGraph: {
    title: "One Stop Handy Man LLC",
    description:
      "Your one-stop shop for home repairs, improvements, and remodels. Locally owned, fully insured.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
