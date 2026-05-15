import { CSSProperties, ReactNode, useEffect, useState } from "react";

/**
 * src 가 없거나 onError 가 발생하면 fallback 을 렌더.
 * src 가 바뀌면 실패 상태 초기화.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  style,
  fallback,
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
