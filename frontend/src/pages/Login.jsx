import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft, Mail, Lock, Loader2,
  Music2, Users, FileCheck2,
} from 'lucide-react';
import { T, TONES, LIFT } from '../theme';
import { APP_VERSION } from '../version';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP step
  const [otpStep, setOtpStep] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!otpStep) {
      if (!email && !password) {
        setError('Please enter your email and password to sign in.');
        return;
      }
      if (!email) { setError('Please enter your email address.'); return; }
      if (!password) { setError('Please enter your password.'); return; }
    }

    if (otpStep) {
      const code = otpDigits.join('');
      if (code.length < 6) {
        setError('Please enter the full 6-digit code from your authenticator app.');
        return;
      }
    }

    setLoading(true);
    try {
      const otp = otpStep ? otpDigits.join('') : undefined;
      const result = await login(email, password, otp);
      if (result?.requireOtp) {
        setOtpStep(true);
        setError('');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('invalid otp')) {
        setError('Invalid OTP. Please check your authenticator app and try again.');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (msg.includes('invalid email or password')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('deactivated')) {
        setError('Your account has been deactivated. Please contact your admin.');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Unable to connect to server. Please check your internet connection.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <style>{LOGIN_CSS}</style>

      {/* Brand panel — hidden below 900px, where the form carries the mark. */}
      <aside className="login-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -8px rgba(0,0,0,0.35)' }}>
            <img src="/mrm-mark.png" alt="" style={{ width: '30px', height: '30px' }} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.3px' }}>MRM Hub</div>
            <div style={{ fontSize: '11px', opacity: 0.8, letterSpacing: '1.6px', textTransform: 'uppercase' }}>CRM Portal</div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '34px', lineHeight: 1.2, fontWeight: 800, marginBottom: '14px', maxWidth: '420px' }}>
            Music rights, managed in one place.
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.88, maxWidth: '400px', marginBottom: '32px' }}>
            Track leads, onboard artists and keep every catalogue and royalty in order — all from your workspace.
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FEATURES.map((f) => (
              <li key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <f.icon style={{ width: '17px', height: '17px' }} />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', opacity: 0.85 }}>
          <span>© {new Date().getFullYear()} Music Rights Management</span>
          <span style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', fontWeight: 600 }}>
            v{APP_VERSION}
          </span>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-card">
          {/* The full lockup carries the "MRMHub" wordmark, so the <h1> wraps
              the image and takes its name from the alt text. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8px' }}>
            <h1 style={{ margin: 0, lineHeight: 0 }}>
              <img
                src="/MRMHub%20Logo.png"
                alt="MRM Hub"
                style={{ width: '150px', maxWidth: '100%', height: 'auto', display: 'block', mixBlendMode: 'multiply' }}
              />
            </h1>
          </div>

          {!otpStep ? (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ color: T.heading, fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>Welcome back</h2>
              <p style={{ color: T.muted, fontSize: '14px' }}>Sign in to manage your workspace</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: TONES.blue.bg, border: `1px solid ${TONES.blue.bd}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <ShieldCheck style={{ width: '26px', height: '26px', color: TONES.blue.fg }} />
              </div>
              <h2 style={{ color: T.heading, fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Two-Factor Authentication</h2>
              <p style={{ color: T.muted, fontSize: '13px' }}>Enter the 6-digit code from your authenticator app</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                marginBottom: '18px',
                borderRadius: '10px',
                backgroundColor: TONES.red.bg,
                border: `1px solid ${TONES.red.bd}`,
                fontSize: '13px',
                color: TONES.red.fg,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {!otpStep ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="login-email" className="login-label">Email</label>
                  <div className="login-field">
                    <Mail className="login-field-icon" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="login-input"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="login-password" className="login-label">Password</label>
                  <div className="login-field">
                    <Lock className="login-field-icon" />
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="login-input"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="login-eye"
                    >
                      {showPw ? <EyeOff style={{ width: '17px', height: '17px' }} /> : <Eye style={{ width: '17px', height: '17px' }} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* OTP 6-digit input */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Digit ${i + 1}`}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className={`login-otp${digit ? ' is-filled' : ''}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
                  className="login-back"
                >
                  <ArrowLeft style={{ width: '14px', height: '14px' }} />
                  Back to login
                </button>
              </>
            )}

            <button type="submit" disabled={loading} className="login-submit">
              {loading && <Loader2 className="login-spin" style={{ width: '17px', height: '17px' }} />}
              {loading ? (otpStep ? 'Verifying...' : 'Signing in...') : (otpStep ? 'Verify OTP' : 'Sign In')}
            </button>
          </form>

          <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '12px', color: T.faint }}>
            <ShieldCheck style={{ width: '14px', height: '14px' }} />
            <span>Secure sign-in</span>
            <span aria-hidden="true">·</span>
            <span style={{ fontWeight: 600, color: TONES.indigo.fg, background: TONES.indigo.bg, border: `1px solid ${TONES.indigo.bd}`, padding: '2px 8px', borderRadius: '999px' }}>
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

const FEATURES = [
  { icon: Users, text: 'Sales pipeline and artist onboarding' },
  { icon: Music2, text: 'Catalogue and society registrations' },
  { icon: FileCheck2, text: 'Royalties, documents and reports' },
];

/* Pseudo-classes and the breakpoint can't be inline styles, so the page keeps
   them here, scoped by the login- prefix. Colours are the theme.js values. */
const LOGIN_CSS = `
.login-root {
  width: 100vw; height: 100vh; overflow-y: auto;
  display: flex; font-family: Inter, system-ui, sans-serif;
  background: ${T.page};
}
.login-brand {
  flex: 0 0 46%; max-width: 640px;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 40px 48px; color: #FFFFFF;
  background:
    radial-gradient(600px 400px at 10% 0%, rgba(102, 187, 106, 0.45), transparent 60%),
    radial-gradient(500px 500px at 100% 100%, rgba(165, 214, 167, 0.25), transparent 60%),
    linear-gradient(160deg, #2E7D32 0%, #1B5E20 55%, #123F16 100%);
}
.login-main {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 32px 16px;
}
.login-card {
  width: 100%; max-width: 420px; padding: 36px 36px 24px;
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 20px;
  box-shadow: ${LIFT};
}
.login-label {
  display: block; font-size: 13px; font-weight: 600; color: ${T.body}; margin-bottom: 8px;
}
.login-field { position: relative; }
.login-field-icon {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  width: 17px; height: 17px; color: ${T.faint}; pointer-events: none;
}
.login-input {
  width: 100%; height: 46px; padding: 0 14px 0 42px;
  background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 10px;
  color: ${T.heading}; font-size: 14px; outline: none;
  transition: border-color .15s, box-shadow .15s, background-color .15s;
}
.login-input::placeholder { color: ${T.faint}; opacity: 1; }
.login-input:hover { border-color: ${T.borderHi}; }
.login-input:focus {
  background: ${T.surface}; border-color: #66BB6A;
  box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2);
}
.login-eye {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  display: inline-flex; padding: 6px; border-radius: 8px;
  background: none; border: none; color: ${T.faint}; cursor: pointer;
}
.login-eye:hover { color: ${T.heading}; background: ${T.raised}; }
.login-otp {
  width: 48px; height: 56px; text-align: center; font-size: 22px; font-weight: 700;
  color: ${T.heading}; background: ${T.bg}; border: 2px solid ${T.border};
  border-radius: 12px; outline: none; caret-color: ${T.heading};
  transition: border-color .15s, box-shadow .15s;
}
.login-otp.is-filled { border-color: ${T.borderHi}; background: ${T.surface}; }
.login-otp:focus { border-color: #66BB6A; box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2); }
.login-back {
  display: flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 0;
  background: none; border: none; color: ${T.muted}; font-size: 13px; cursor: pointer;
}
.login-back:hover { color: ${T.heading}; }
.login-submit {
  width: 100%; height: 48px; border: none; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: ${T.accentGradient}; color: #FFFFFF; font-size: 15px; font-weight: 700;
  cursor: pointer; box-shadow: 0 10px 22px -12px rgba(27, 94, 32, 0.7);
  transition: transform .15s, box-shadow .15s, opacity .2s;
}
.login-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 26px -12px rgba(27, 94, 32, 0.8); }
.login-submit:focus-visible { outline: 3px solid #66BB6A; outline-offset: 2px; }
.login-submit:disabled { opacity: .7; cursor: not-allowed; }
.login-spin { animation: login-spin 0.8s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .login-brand { display: none; }
}
@media (max-width: 480px) {
  .login-card { padding: 28px 20px 20px; }
  .login-otp { width: 40px; height: 50px; font-size: 20px; }
}
`;

export default Login;
