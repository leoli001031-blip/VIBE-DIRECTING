import { useEffect, useState } from "react";

export function toMediaSrc(path?: string) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("/")) return `/@fs${path}`;
  return path;
}

export function MediaFrame({
  src,
  alt,
  label,
  className = "",
}: {
  src?: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const mediaSrc = toMediaSrc(src);
  if (!mediaSrc || failed) {
    return <div className={`minimal-media-placeholder ${className}`}>{label}</div>;
  }

  return <img className={className} src={mediaSrc} alt={alt} onError={() => setFailed(true)} />;
}
