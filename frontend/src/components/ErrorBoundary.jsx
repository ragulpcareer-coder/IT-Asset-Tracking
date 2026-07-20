import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Unhandled render error:", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#9ca3af", maxWidth: 420 }}>
          This section of the app hit an unexpected error. Reloading usually fixes it — if it
          keeps happening, please let an administrator know what you were doing right before this.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload the app
        </button>
      </div>
    );
  }
}
