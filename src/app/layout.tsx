import type { Metadata, Viewport } from "next";
import { Gilda_Display, Montserrat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const gilda = Gilda_Display({
  variable: "--font-gilda",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Comunidade Mariana Valentina",
    template: "%s · Comunidade Mariana Valentina",
  },
  description:
    "Comunidade por assinatura para fisioterapeutas pélvicas: condutas semanais, artigos comentados, rounds clínicos e biblioteca de materiais.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#e9726d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${gilda.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
