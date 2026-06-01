import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught a rendering error:", error);
    console.error("Component stack:", info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const label = this.props.fallbackLabel ?? "内容区域";
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-fallback-card">
            <h2>出错了</h2>
            <p>{label} 渲染时发生了意外错误。</p>
            <p className="error-boundary-fallback-detail">
              {this.state.error?.message || "未知错误"}
            </p>
            <button
              className="error-boundary-reload-button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
