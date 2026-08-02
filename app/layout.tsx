import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "../components/auth-provider";

export const metadata: Metadata = {
  title: { default: "Proxy Management", template: "%s | Proxy Management" },
  description: "Secure multi-school proxy and timetable management",
  applicationName: "Proxy Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
