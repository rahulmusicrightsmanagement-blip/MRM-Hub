import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Music, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';

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
        backgroundColor: '#0f1117',
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
          backgroundColor: '#141720',
          borderRadius: '16px',
          border: '1px solid #1e2540',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', justifyContent: 'center' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Music style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, fontSize: '20px', lineHeight: '1.2' }}>MRM Hub</h1>
            <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>CRM Portal</p>
          </div>
        </div>

        {!otpStep ? (
          <>
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '6px' }}>Welcome Back</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>Sign in to manage your workspace</p>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(59,130,246,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <ShieldCheck style={{ width: '26px', height: '26px', color: '#60a5fa' }} />
              </div>
              <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Two-Factor Authentication</h2>
              <p style={{ color: '#6b7280', fontSize: '13px' }}>Enter the 6-digit code from your authenticator app</p>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              padding: '12px 14px',
              marginBottom: '18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '13px',
              color: '#f87171',
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
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>
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
                    backgroundColor: '#0f1117',
                    border: '1px solid #1e2540',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>
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
                      backgroundColor: '#0f1117',
                      border: '1px solid #1e2540',
                      borderRadius: '8px',
                      color: 'white',
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
                      color: '#6b7280',
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
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
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
                      color: 'white',
                      backgroundColor: '#0f1117',
                      border: `2px solid ${digit ? '#3b82f6' : '#1e2540'}`,
                      borderRadius: '10px',
                      outline: 'none',
                      caretColor: '#3b82f6',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                    onBlur={(e) => { if (!digit) e.target.style.borderColor = '#1e2540'; }}
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
                  color: '#6b7280',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginBottom: '18px',
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
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
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
