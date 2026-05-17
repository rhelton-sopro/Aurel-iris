import type { Metadata, Viewport } from "next";
import { Raleway, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Brand voice = Raleway (mesma família do wordmark do logo). Light/ExtraLight
// com tracking largo carrega o "luxo silencioso". latin-ext cobre acentos pt-BR.
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin", "latin-ext"],
  weight: ["200", "300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Iris Codex",
  description: "A íris como mapa do ser.",
  applicationName: "Iris Codex",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Iris Codex",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${raleway.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          position="bottom-center"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
