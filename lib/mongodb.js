// 몽고DB(인터넷 저장 창고)에 연결하는 부분 (고칠 필요 없음)
// 연결 주소는 .env.local 파일의 MONGODB_URI 값을 사용합니다.
import { MongoClient } from "mongodb";

const 데이터베이스이름 = "linktree";
const 컬렉션이름 = "clicks"; // 클릭 수를 담는 칸 이름

// 개발 중 파일을 고칠 때마다 연결이 새로 생기지 않도록 한 번 만든 연결을 기억해 둠
let 연결약속 = globalThis._몽고연결;

function 연결하기() {
  if (!process.env.MONGODB_URI) {
    throw new Error(".env.local 파일에 MONGODB_URI 가 없습니다.");
  }
  if (!연결약속) {
    연결약속 = new MongoClient(process.env.MONGODB_URI).connect();
    globalThis._몽고연결 = 연결약속;
    // 연결에 실패하면 다음에 다시 시도할 수 있게 기억을 지움
    연결약속.catch(() => {
      연결약속 = undefined;
      globalThis._몽고연결 = undefined;
    });
  }
  return 연결약속;
}

// 클릭 수를 담는 칸 가져오기
export async function 클릭칸() {
  const 연결 = await 연결하기();
  return 연결.db(데이터베이스이름).collection(컬렉션이름);
}

// 모든 버튼의 클릭 수를 { "유튜브 채널": 12, ... } 모양으로 가져오기
export async function 클릭수모두가져오기() {
  const 칸 = await 클릭칸();
  const 목록 = await 칸.find({}).toArray();
  const 결과 = {};
  목록.forEach((항목) => {
    결과[항목._id] = 항목.count;
  });
  return 결과;
}

// 버튼 하나의 클릭 수를 1 늘리기 (처음 누른 버튼이면 새로 만듦)
export async function 클릭수올리기(버튼이름) {
  const 칸 = await 클릭칸();
  await 칸.updateOne({ _id: 버튼이름 }, { $inc: { count: 1 } }, { upsert: true });
}
