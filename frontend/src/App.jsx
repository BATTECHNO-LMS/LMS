import { AppProviders } from './app/providers/index.jsx';
import { AppRouter } from './app/router/index.jsx';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
