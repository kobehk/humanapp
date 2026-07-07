import type { Metadata } from "next";
import Script from "next/script";
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
        {/* 百度统计 */}
        <Script id="baidu-tongji" strategy="afterInteractive">
          {`
            var _hmt = _hmt || [];
            (function() {
              var hm = document.createElement("script");
              hm.src = "https://hm.baidu.com/hm.js?b86e46242ccd68a89a6d4a35099d0444";
              var s = document.getElementsByTagName("script")[0];
              s.parentNode.insertBefore(hm, s);
            })();
          `}
        </Script>
        {/* 穿山甲 Web SDK */}
        <Script
          src="https://lf-cdn-tos.bytescm.com/obj/union-fe/sdk/byted-sdk.js"
          strategy="lazyOnload"
        />
        {/* 优量汇 Web SDK */}
        <Script
          src="https://qzs.gdtimg.com/union/res/union_sdk.min.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
