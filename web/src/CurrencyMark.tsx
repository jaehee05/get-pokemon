/**
 * 캐시 단위 'C' 를 노란 원형 배지 형태로 표현.
 * 텍스트와 같이 inline 으로 배치되도록 설계.
 */
export function CurrencyMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="c-mark"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.6),
      }}
      aria-label="C"
    >
      C
    </span>
  );
}
