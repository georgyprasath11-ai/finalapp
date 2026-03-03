import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                The app hit an unexpected error. Reload to recover safely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={this.handleReload}>Reload App</Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
