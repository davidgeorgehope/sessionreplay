import { Link, Routes, Route } from 'react-router-dom';
import { FrustrationDemo } from './components/FrustrationDemo';
import { CheckoutDemo } from './components/CheckoutDemo';

function Home() {
  return (
    <div className="container">
      <h1>Session Replay Alternative Demo</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        This demo shows AI-native session understanding through semantic events
        and frustration detection instead of DOM recording.
      </p>

      <div className="card">
        <h2>How It Works</h2>
        <p>Open your browser's DevTools console to see events being captured:</p>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          <li><strong>Semantic clicks</strong> - Every click captures what was clicked, not just coordinates</li>
          <li><strong>Rage clicks</strong> - 3+ rapid clicks trigger frustration detection</li>
          <li><strong>Dead clicks</strong> - Clicks on non-interactive elements are flagged</li>
          <li><strong>Form hesitation</strong> - Long pauses on form fields indicate confusion</li>
        </ul>
      </div>

      <div className="card">
        <h2>Try the Demos</h2>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Link to="/frustration">
            <button>Frustration Detection Demo</button>
          </Link>
          <Link to="/checkout">
            <button>Checkout Form Demo</button>
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>Quick Test</h2>
        <p style={{ marginBottom: '1rem' }}>
          Try clicking this button rapidly 3+ times to trigger rage click detection:
        </p>
        <button data-testid="quick-test-btn">Click me rapidly!</button>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/frustration">Frustration Demo</Link>
        <Link to="/checkout">Checkout Demo</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/frustration" element={<FrustrationDemo />} />
        <Route path="/checkout" element={<CheckoutDemo />} />
      </Routes>
    </>
  );
}

export default App;
