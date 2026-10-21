"use client";
// 링크 버튼 목록 + 클릭 수 표시 (고칠 필요 없음)
import { useState } from "react";

export default function 링크버튼들({ 링크목록, 처음클릭수 }) {
  const [클릭수, 클릭수바꾸기] = useState(처음클릭수);

  function 눌렀을때(버튼이름) {
    // 화면의 숫자를 바로 1 올림
    클릭수바꾸기((이전) => ({ ...이전, [버튼이름]: (이전[버튼이름] || 0) + 1 }));

    // 몽고DB에 저장하라고 신호 보내기 (실패해도 링크는 그대로 열림)
    fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 이름: 버튼이름 }),
      keepalive: true, // 페이지를 떠나도 신호가 끝까지 가도록
    }).catch(() => {});
  }

  return (
    <nav className="버튼자리">
      {링크목록.map((링크) => (
        <a
          key={링크.이름}
          className="링크버튼"
          href={링크.주소}
          target="_blank"
          rel="noopener"
          onClick={() => 눌렀을때(링크.이름)}
        >
          <span className="아이콘">{링크.아이콘}</span>
          <span>{링크.이름}</span>
          {/* 기능 5. 클릭 수 */}
          <span className="클릭수">{(클릭수[링크.이름] || 0).toLocaleString("ko-KR")}회</span>
        </a>
      ))}
    </nav>
  );
}
