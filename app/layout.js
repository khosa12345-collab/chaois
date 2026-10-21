// 모든 페이지에 공통으로 들어가는 틀 (고칠 필요 없음)
import "./globals.css";
import { 프로필 } from "./설정";

export const metadata = {
  title: `${프로필.이름} 링크나무`,
  description: 프로필.소개,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function 기본틀({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 글씨체: 깔끔한 '프리텐다드' (인터넷이 없으면 컴퓨터 기본 글씨체로 보입니다) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
