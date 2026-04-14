import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-5">
          <div className="alert alert-danger" role="alert">
            <h1 className="h4">Something went wrong</h1>
            <p className="mb-0">Please refresh the page. If the problem continues, contact support.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
