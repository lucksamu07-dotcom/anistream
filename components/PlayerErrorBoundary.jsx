import React from "react";

export default class PlayerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep app usable if a browser/player integration mutates DOM unexpectedly.
    console.error("Player render error:", error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // Retry when user switches source/server.
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-neutral-300">
          <p>Este servidor fallo al cargar.</p>
          <p className="text-neutral-500">Prueba otro servidor o idioma.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
