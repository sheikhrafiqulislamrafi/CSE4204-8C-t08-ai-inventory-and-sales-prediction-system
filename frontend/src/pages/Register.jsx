import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import api from '../services/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.register(email, password, businessName);
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              background: 'var(--primary-gradient)',
              borderRadius: 16,
              padding: '1rem',
              display: 'inline-flex',
              boxShadow: 'var(--accent-glow)',
            }}
          >
            <Store size={32} color="white" />
          </div>
        </div>

        <h2>Create Account</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
          Start automating your business insights
        </p>

        {error && (
          <div className="error-message" style={{ marginTop: '1.25rem' }}>{error}</div>
        )}

        <form onSubmit={handleRegister} className="auth-form">
          <input
            type="text"
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            autoComplete="organization"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}
