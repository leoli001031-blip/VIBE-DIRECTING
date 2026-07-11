export interface TrustedRendererPolicy {
  webContentsId: number;
  documentUrl: string;
}

export interface RendererSenderDescriptor {
  webContentsId: number;
  frameUrl: string;
  isMainFrame: boolean;
}

export function runtimeLoopbackHost(candidate = "127.0.0.1") {
  const normalized = candidate.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1") {
    return "127.0.0.1";
  }
  throw new Error(`Runtime API host must be loopback-only: ${candidate}`);
}

export function isTrustedDocumentUrl(candidateUrl: string, trustedDocumentUrl: string) {
  try {
    const candidate = new URL(candidateUrl);
    const trusted = new URL(trustedDocumentUrl);
    if (candidate.protocol !== trusted.protocol) return false;
    if (candidate.protocol === "file:") {
      return candidate.host === trusted.host && candidate.pathname === trusted.pathname;
    }
    return candidate.origin === trusted.origin && candidate.pathname === trusted.pathname;
  } catch {
    return false;
  }
}

export function isTrustedRendererSender(
  sender: RendererSenderDescriptor,
  policy: TrustedRendererPolicy,
) {
  return sender.webContentsId === policy.webContentsId
    && sender.isMainFrame
    && isTrustedDocumentUrl(sender.frameUrl, policy.documentUrl);
}

export function isSafeExternalUrl(candidateUrl: string) {
  try {
    const candidate = new URL(candidateUrl);
    return (candidate.protocol === "https:" || candidate.protocol === "http:")
      && !candidate.username
      && !candidate.password;
  } catch {
    return false;
  }
}
