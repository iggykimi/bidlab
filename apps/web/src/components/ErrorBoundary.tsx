import { Component, type ReactNode } from "react";
import { Alert, Button, Card } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort crash fence: a render throw becomes a Spanish recovery card. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error("Error desconocido") };
  }

  componentDidCatch(): void {
    // Intentionally silent: no remote reporting in the local demo.
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-4xl p-4 sm:p-8">
          <Card>
            <h1 className="text-xl font-bold">No pudimos mostrar esta página</h1>
            <Alert
              className="mt-3"
              title={this.state.error.message}
            >
              Algo falló en esta página. Tus datos siguen en tu equipo.
            </Alert>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()}>Recargar</Button>
              <Button variant="subtle" onClick={() => this.setState({ error: null })}>
                Reintentar sin recargar
              </Button>
            </div>
          </Card>
        </main>
      );
    }
    return this.props.children;
  }
}
