import { Component } from 'react';
import { ErrorState } from './Feedback.jsx';

// Si una pantalla falla al pintarse, se muestra un error recuperable en lugar de una página en blanco.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32 }}>
        <ErrorState
          title="Esta pantalla no se ha podido mostrar"
          error={{ message: 'Recarga la página. Si vuelve a ocurrir, prueba desde otra sección.' }}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}
