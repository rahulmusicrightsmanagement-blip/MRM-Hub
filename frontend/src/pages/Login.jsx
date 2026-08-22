import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { T } from '../theme';

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
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#E8F5E9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(165, 214, 167, 0.55)',
        }}
      >
        {/* Logo — the full lockup. It already carries the "MRMHub" wordmark,
            so there is no heading text beside it; the <h1> wraps the image and
            takes its name from the alt text. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, lineHeight: 0 }}>
            <img
              src="/MRMHub%20Logo.png"
              alt="MRM Hub"
              style={{ width: '190px', maxWidth: '100%', height: 'auto', display: 'block' }}
            />
          </h1>
          <p style={{ color: T.faint, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '-14px' }}>
            CRM Portal
          </p>
        </div>

        {!otpStep ? (
          <>
            <h2 style={{ color: '#1B5E20', fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '6px' }}>Welcome Back</h2>
            <p style={{ color: '#5B7362', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>Sign in to manage your workspace</p>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(30, 136, 229, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <ShieldCheck style={{ width: '26px', height: '26px', color: '#0D47A1' }} />
              </div>
              <h2 style={{ color: '#1B5E20', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Two-Factor Authentication</h2>
              <p style={{ color: '#5B7362', fontSize: '13px' }}>Enter the 6-digit code from your authenticator app</p>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              padding: '12px 14px',
              marginBottom: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(229, 57, 53, 0.12)',
              border: '1px solid rgba(229, 57, 53, 0.25)',
              fontSize: '13px',
              color: '#B71C1C',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!otpStep ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4A6851', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#E8F5E9',
                    border: '1px solid rgba(165, 214, 167, 0.55)',
                    borderRadius: '8px',
                    color: '#1B5E20',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4A6851', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      backgroundColor: '#E8F5E9',
                      border: '1px solid rgba(165, 214, 167, 0.55)',
                      borderRadius: '8px',
                      color: '#1B5E20',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#5B7362',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
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
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: '48px',
                      height: '56px',
                      textAlign: 'center',
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#1B5E20',
                      backgroundColor: '#E8F5E9',
                      border: `2px solid ${digit ? '#BBDEFB' : 'rgba(165, 214, 167, 0.55)'}`,
                      borderRadius: '10px',
                      outline: 'none',
                      caretColor: '#0D47A1',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#0D47A1'; }}
                    onBlur={(e) => { if (!digit) e.target.style.borderColor = '#5B7362'; }}
                  />
                ))}
              </div>

              {/* Back button */}
              <button
                type="button"
                onClick={() => { setOtpStep(false); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#5B7362',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  padding: 0,
                }}
              >
                <ArrowLeft style={{ width: '14px', height: '14px' }} />
                Back to login
              </button>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #1565C0, #1B5E20)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? (otpStep ? 'Verifying...' : 'Signing in...') : (otpStep ? 'Verify OTP' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
