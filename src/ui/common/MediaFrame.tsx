import { useEffect, useState } from "react";
import { toRuntimeUrl } from "../../core/runtimeApiClient";

export function toMediaSrc(path?: string) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("/api/runtime/")) return toRuntimeUrl(path);
  if (path.startsWith("user_selected_import/")) return undefined;
  if (path.startsWith("file://")) return path;
  const normalized = path.replace(/\\/g, "/");
  if (typeof window !== "undefined" && window.vibeRuntime && normalized.startsWith("/")) {
    return `file://${encodeURI(normalized)}`;
  }
  return toRuntimeUrl(`/api/runtime/files?path=${encodeURIComponent(normalized)}`);
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
