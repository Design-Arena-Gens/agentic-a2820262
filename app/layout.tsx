import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Fira_Code } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-fira-code"
});

export const metadata = {
  title: "Agentic Code Creator",
  description:
    "Unified online code creator with multi-provider LLM integration, agentic CLI workflows, and React-first previews."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${firaCode.variable} antialiased bg-slate-950 text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
