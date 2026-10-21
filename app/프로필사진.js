"use client";
// 프로필 사진: 사진 파일이 없으면 이름 첫 글자 동그라미로 대신 보여줌 (고칠 필요 없음)
import { useState } from "react";

export default function 프로필사진({ 사진, 이름 }) {
  const [사진없음, 사진없음으로] = useState(false);

  return (
    <div className="사진자리">
      {사진없음 ? (
        <div className="대체사진">{이름.charAt(0)}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="프로필사진" src={사진} alt={`${이름} 프로필 사진`} onError={() => 사진없음으로(true)} />
      )}
    </div>
  );
}
