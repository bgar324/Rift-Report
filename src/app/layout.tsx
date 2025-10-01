import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-exo2",
});

export const metadata: Metadata = {
  title: "Rift Report",
  description: "League of Legends Performance Dashboard",
  icons: {
    icon: "/rift-report.png",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={exo2.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
