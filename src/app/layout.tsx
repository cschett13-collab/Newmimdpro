import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fox Valley Client Engine — Client Portal",
  description:
    "Live client reporting powered by HighLevel. Built and operated by IMD.",
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
