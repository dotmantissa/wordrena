import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wordrena",
    template: "%s | Wordrena",
  },
  description:
    "Write a creature move in plain English, let GenLayer weigh it, then see whether it survives the arena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
