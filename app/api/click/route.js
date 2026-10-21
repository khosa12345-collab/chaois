// 버튼을 누르면 이곳으로 신호가 와서 클릭 수를 1 늘립니다 (고칠 필요 없음)
import { 링크목록 } from "../../설정";
import { 클릭수올리기 } from "../../../lib/mongodb";

export async function POST(요청) {
  let 버튼이름;
  try {
    버튼이름 = (await 요청.json()).이름;
  } catch {
    return Response.json({ 결과: "잘못된 요청" }, { status: 400 });
  }

  // 설정.js 에 있는 버튼만 셈 (아무 이름이나 저장되지 않게)
  if (!링크목록.some((링크) => 링크.이름 === 버튼이름)) {
    return Response.json({ 결과: "없는 버튼" }, { status: 400 });
  }

  try {
    await 클릭수올리기(버튼이름);
    return Response.json({ 결과: "저장됨" });
  } catch (오류) {
    console.error("클릭 수 저장 실패:", 오류.message);
    return Response.json({ 결과: "저장 실패" }, { status: 500 });
  }
}
