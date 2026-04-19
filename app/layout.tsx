import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "../components/AppHeader";

export const metadata: Metadata = {
  title: "Goshsha Marketplace",
  description: "Creator and brand dashboard for IRL AR campaigns.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}