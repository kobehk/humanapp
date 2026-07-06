import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "假扮 AI",
  description: "在 AI 夺走人类工作的世界里，用假扮 AI 来夺走 AI 的工作。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full">
      <body className="min-h-full flex flex-col" style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
