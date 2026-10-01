import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Padauk, Noto_Serif_Myanmar } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["200", "300", "500", "800"],
  display: "swap",
});

const padauk = Padauk({
  variable: "--font-padauk",
  subsets: ["myanmar"],
  weight: ["400", "700"],
  display: "swap",
});

/* the formal face — invitations and album covers set in Album */
const myserif = Noto_Serif_Myanmar({
  variable: "--font-myserif",
  subsets: ["myanmar"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHOW",
  description: "Myanmar's prompt studio.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${padauk.variable} ${myserif.variable} grain`}>
        {children}
      </body>
    </html>
  );
}
