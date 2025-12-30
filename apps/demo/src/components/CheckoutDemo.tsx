import { useState } from 'react';
import { formTracker } from '../instrumentation';

export function CheckoutDemo() {
  const [formData, setFormData] = useState({
    email: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Simulate validation errors that don't show well
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    if (formData.cardNumber.length < 16) {
      setError('Invalid card number');
      return;
    }

    // Simulate successful submission
    formTracker.recordFormSubmit('checkout-form', true);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container">
        <div className="card">
          <h2>Order Confirmed!</h2>
          <p>Thank you for your purchase.</p>
          <button onClick={() => setSubmitted(false)} style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Checkout Demo</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        This form demonstrates form tracking and hesitation detection.
        Try pausing for 10+ seconds on a field to trigger hesitation detection.
      </p>

      <div className="warning">
        <strong>Demo Mode:</strong> This is a simulated checkout. No real payment
        will be processed. Watch the console for form tracking events!
      </div>

      <div className="card">
        <h2>Payment Details</h2>
        <form onSubmit={handleSubmit} id="checkout-form" name="checkout-form">
          {error && (
            <div className="error">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              data-field="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Name on Card</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Smith"
              data-field="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cardNumber">Card Number</label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={formData.cardNumber}
              onChange={handleChange}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              data-field="card-number"
            />
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '-0.5rem' }}>
              Try hesitating here for 10+ seconds (looking up your card)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="expiry">Expiry Date</label>
              <input
                type="text"
                id="expiry"
                name="expiry"
                value={formData.expiry}
                onChange={handleChange}
                placeholder="MM/YY"
                maxLength={5}
                data-field="expiry"
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="cvv">CVV</label>
              <input
                type="text"
                id="cvv"
                name="cvv"
                value={formData.cvv}
                onChange={handleChange}
                placeholder="123"
                maxLength={4}
                data-field="cvv"
              />
            </div>
          </div>

          <button type="submit" style={{ width: '100%', marginTop: '1rem' }}>
            Pay $99.99
          </button>
        </form>
      </div>

      <div className="card">
        <h3>What's Being Tracked</h3>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>Time spent on each field</li>
          <li>Hesitation detection (&gt;10s on a field)</li>
          <li>Form submission success/failure</li>
          <li>Click events on submit button</li>
        </ul>
        <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
          In a real scenario, if you navigate away without submitting, form
          abandonment would be tracked.
        </p>
      </div>
    </div>
  );
}
