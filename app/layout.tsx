import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "비교 인터페이스 사용성 실험",
  description: "졸업논문 실험환경 (더미 데이터 / UI 테스트용)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
