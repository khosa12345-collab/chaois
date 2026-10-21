// 메인 화면 (고칠 필요 없음, 내용은 설정.js 에서 바꿉니다)
import { 프로필, 링크목록 } from "./설정";
import { 클릭수모두가져오기 } from "../lib/mongodb";
import 프로필사진 from "./프로필사진";
import 링크버튼들 from "./링크버튼들";

// 화면을 열 때마다 최신 클릭 수를 새로 가져옴
export const dynamic = "force-dynamic";

export default async function 메인화면() {
  // 몽고DB에서 클릭 수 가져오기 (실패해도 화면은 정상으로 보여줌)
  let 클릭수 = {};
  try {
    클릭수 = await 클릭수모두가져오기();
  } catch (오류) {
    console.error("클릭 수 불러오기 실패:", 오류.message);
  }

  return (
    <main className="내용">
      {/* 기능 1. 프로필 영역 (사진 + 이름 + 소개) */}
      <프로필사진 사진={프로필.사진} 이름={프로필.이름} />
      <h1 className="이름">{프로필.이름}</h1>
      <p className="소개">{프로필.소개}</p>

      {/* 기능 2·5. 링크 버튼 목록 + 클릭 수 */}
      <링크버튼들 링크목록={링크목록} 처음클릭수={클릭수} />
    </main>
  );
}
