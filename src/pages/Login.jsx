import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, BarChart3, BrainCircuit, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.auth.login(email, password);

      localStorage.setItem('token', data.token);
      localStorage.setItem('business_name', data.user?.business_name || '');


      const userObj = {
        email,
        business_name: data.user?.business_name || '',
        role: data.user?.role || 'owner',
      };
      if (onLogin) onLogin(userObj);

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const features = [
    {
      icon: <BarChart3 size={18} />,
      text: 'Real-time sales & profit dashboards',
    },
    {
      icon: <BrainCircuit size={18} />,
      text: 'AI-powered insights via Gemma 4',
    },
    {
      icon: <ShieldCheck size={18} />,
      text: 'Role-based access for your whole team',
    },
  ];

  return (
    <div className="auth-container">
      <div className="auth-split">
        {}
        <div className="auth-intro">
          <div className="auth-intro-inner">
            {}
            <div className="auth-intro-glow" aria-hidden="true" />

            <div className="auth-intro-brand">
              <div className="auth-intro-icon">
                <Store size={24} color="white" />
              </div>
              <span className="auth-intro-logo">myShop AI</span>
            </div>

            <h1 className="auth-intro-headline">
              Your AI-Powered
              <br />
              Business Analyst
            </h1>

            <p className="auth-intro-tagline">
              Turn everyday sales data into actionable insights.
            </p>

            <ul className="auth-intro-features">
              {features.map((f, i) => (
                <li key={i} className="auth-intro-feature" style={{ animationDelay: `${0.35 + i * 0.1}s` }}>
                  <span className="auth-intro-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {}
        <div className="auth-form-panel">
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

            <h2>Welcome Back</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Sign in to your myShop AI dashboard
            </p>

            {error && (
              <div className="error-message" style={{ marginTop: '1.25rem' }}>{error}</div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
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
                autoComplete="current-password"
              />
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="auth-footer">
              Don&apos;t have an account? <Link to="/register">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
