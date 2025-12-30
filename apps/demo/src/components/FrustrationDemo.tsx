import { useState } from 'react';

export function FrustrationDemo() {
  const [submitCount, setSubmitCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleBrokenSubmit = () => {
    // Intentionally slow/broken button
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitCount((c) => c + 1);
    }, 2000);
  };

  return (
    <div className="container">
      <h1>Frustration Detection Demo</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        This page contains intentionally frustrating UI elements to demonstrate
        our frustration detection capabilities. Watch the console for events!
      </p>

      <div className="demo-section">
        <h3>Rage Click Detection</h3>
        <div className="card">
          <h4>Slow Button</h4>
          <p style={{ marginBottom: '1rem' }}>
            This button takes 2 seconds to respond. Try clicking it multiple times
            in frustration - rage clicks will be detected!
          </p>
          <button
            onClick={handleBrokenSubmit}
            disabled={isLoading}
            className={isLoading ? 'slow-response loading' : ''}
            data-testid="slow-button"
          >
            {isLoading ? 'Processing...' : 'Submit (Slow)'}
          </button>
          {submitCount > 0 && (
            <p style={{ marginTop: '0.5rem', color: '#666' }}>
              Submitted {submitCount} time(s)
            </p>
          )}
        </div>
      </div>

      <div className="demo-section">
        <h3>Dead Click Detection</h3>
        <div className="card">
          <h4>Non-Interactive Elements</h4>
          <p style={{ marginBottom: '1rem' }}>
            These elements look clickable but aren't. Clicking them will trigger
            dead click detection.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              className="looks-clickable"
              style={{ padding: '0.5rem 1rem', background: '#f0f0f0', borderRadius: '4px' }}
            >
              Click me (I'm just a div)
            </div>

            <span className="looks-clickable">
              I look like a link
            </span>

            <button disabled data-testid="disabled-btn">
              Disabled Button
            </button>
          </div>
        </div>
      </div>

      <div className="demo-section">
        <h3>Combined Frustration</h3>
        <div className="card">
          <h4>The Impossible Button</h4>
          <p style={{ marginBottom: '1rem' }}>
            This button is disabled and looks broken. Users might rage click it
            trying to get it to work, triggering both rage click and dead click detection.
          </p>
          <button
            disabled
            style={{ opacity: 0.5 }}
            data-testid="impossible-btn"
          >
            Complete Purchase (Coming Soon)
          </button>
          <p style={{ marginTop: '0.5rem', color: '#999', fontSize: '0.9rem' }}>
            Feature unavailable
          </p>
        </div>
      </div>

      <div className="demo-section">
        <h3>Misclick Traps</h3>
        <div className="card">
          <h4>Confusing Layout</h4>
          <p style={{ marginBottom: '1rem' }}>
            Multiple similar-looking elements close together. Users might click
            the wrong one.
          </p>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button>Confirm</button>
            <button>Confirm</button>
            <button style={{ background: '#dc3545' }}>Cancel</button>
            <button>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
