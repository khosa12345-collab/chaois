import type { KeyboardEvent } from 'react'

// 한글 등 IME로 글자를 조합하는 중에 누른 키. 이때 Enter를 처리하면 마지막 음절이 빠지거나 입력 칸에 남는다.
export const isComposing = (e: KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229
