import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { currentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wordrena",
    template: "%s | Wordrena",
  },
  description:
    "Write a creature move in plain English, let GenLayer weigh it, then see whether it survives the arena.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </body>
    </html>
  );
}
