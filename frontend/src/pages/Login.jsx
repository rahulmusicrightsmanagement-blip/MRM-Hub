import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft, ArrowRight, Mail, Lock,
  Loader2, CheckCircle2, KeyRound, Sparkles,
} from 'lucide-react';
import { T, TONES, LIFT } from '../theme';
import { APP_VERSION } from '../version';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Seconds left in the current 30-second authenticator window. */
const totpSecondsLeft = () => 30 - (Math.floor(Date.now() / 1000) % 30);

const TRUST = ['Encrypted session', 'Two-factor ready', 'Role-based access'];

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // OTP step
  const [otpStep, setOtpStep] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(totpSecondsLeft);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (!otpStep) return undefined;
    const id = setInterval(() => setSecondsLeft(totpSecondsLeft()), 1000);
    return () => clearInterval(id);
  }, [otpStep]);

  const fail = (msg) => {
    setError(msg);
    setErrorKey((k) => k + 1);
  };

  const emailValid = EMAIL_RE.test(email.trim());
  const emailInvalid = emailTouched && email.trim() !== '' && !emailValid;

  const submit = async (otpCode) => {
    setError('');

    if (!otpStep) {
      if (!email && !password) { fail('Please enter your email and password to sign in.'); return; }
      if (!email) { fail('Please enter your email address.'); return; }
      if (!emailValid) { fail('That email address does not look right.'); return; }
      if (!password) { fail('Please enter your password.'); return; }
    }

    const code = otpCode ?? otpDigits.join('');
    if (otpStep && code.length < 6) {
      fail('Please enter the full 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password, otpStep ? code : undefined);
      if (result?.requireOtp) {
        setOtpStep(true);
        setSecondsLeft(totpSecondsLeft());
        setError('');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('invalid otp')) {
        fail('Invalid OTP. Please check your authenticator app and try again.');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (msg.includes('invalid email or password')) {
        fail('Incorrect email or password. Please try again.');
      } else if (msg.includes('deactivated')) {
        fail('Your account has been deactivated. Please contact your admin.');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        fail('Unable to connect to server. Please check your internet connection.');
      } else {
        fail(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) submit();
  };

  // The last digit submits on its own — no reaching for the button.
  const setDigits = (next, focusIdx) => {
    setOtpDigits(next);
    if (next.every(Boolean) && !loading) submit(next.join(''));
    else otpRefs.current[focusIdx]?.focus();
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setDigits(next, value && index < 5 ? index + 1 : index);
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setDigits(next, Math.min(pasted.length, 5));
  };

  const checkCaps = (e) => setCapsOn(!!e.getModifierState?.('CapsLock'));

  const backToLogin = () => {
    setOtpStep(false);
    setOtpDigits(['', '', '', '', '', '']);
    setError('');
  };

  const ringPct = secondsLeft / 30;

  return (
    <div className="login-root">
      <style>{LOGIN_CSS}</style>

      {/* ── Brand panel — hidden below 1000px ─────────────────────────── */}
      <aside className="login-brand">
        <div className="login-grid" aria-hidden="true" />
        <div className="login-orb login-orb-a" aria-hidden="true" />
        <div className="login-orb login-orb-b" aria-hidden="true" />

        <div className="login-brand-inner">
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="login-mark-tile">
                <img src="/mrm-mark.png" alt="" style={{ width: '30px', height: '30px' }} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.3px' }}>MRM Hub</div>
                <div style={{ fontSize: '11px', opacity: 0.85, letterSpacing: '1.6px', textTransform: 'uppercase' }}>CRM Portal</div>
              </div>
            </div>
            <span className="login-glass-pill">
              <Sparkles style={{ width: '13px', height: '13px' }} />
              Version {APP_VERSION}
            </span>
          </header>

          <div className="login-rise" style={{ animationDelay: '.05s' }}>
            <p className="login-eyebrow">Music Rights Management</p>
            <h2 className="login-headline">
              Every right. Every royalty.
              <br />
              <span className="login-headline-accent">One hub.</span>
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.65, opacity: 0.92, maxWidth: '440px' }}>
              The workspace where your team signs artists, manages catalogues and keeps
              every payout accounted for.
            </p>
          </div>

          <footer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {TRUST.map((t) => (
                <span key={t} className="login-glass-pill" style={{ fontWeight: 500 }}>
                  <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                  {t}
                </span>
              ))}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>
              © {new Date().getFullYear()} Music Rights Management · All rights reserved
            </div>
          </footer>
        </div>
      </aside>

      {/* ── Form side ─────────────────────────────────────────────────── */}
      <main className="login-main">
        <div className="login-card login-rise">
          {/* Mark + name only when the brand panel is hidden. */}
          <div className="login-mobile-brand">
            <img src="/mrm-mark.png" alt="" style={{ width: '40px', height: '40px' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '17px', fontWeight: 800, color: T.heading }}>MRM Hub</div>
              <div style={{ fontSize: '10px', letterSpacing: '1.6px', textTransform: 'uppercase', color: T.faint }}>CRM Portal</div>
            </div>
          </div>

          {/* Two-step indicator */}
          <ol className="login-steps" aria-label="Sign-in progress">
            <li className={otpStep ? 'is-done' : 'is-active'}>
              <span className="login-step-dot">{otpStep ? <CheckCircle2 style={{ width: '14px', height: '14px' }} /> : 1}</span>
              Credentials
            </li>
            <li className="login-step-line" aria-hidden="true" />
            <li className={otpStep ? 'is-active' : ''}>
              <span className="login-step-dot">2</span>
              Verify
            </li>
          </ol>

          {!otpStep ? (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: TONES.indigo.fg, marginBottom: '4px' }}>{greeting()} 👋</p>
              <h1 style={{ color: T.heading, fontSize: '26px', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.3px' }}>Welcome back</h1>
              <p style={{ color: T.muted, fontSize: '14px' }}>Sign in to continue to your workspace.</p>
            </div>
          ) : (
            <div style={{ marginBottom: '22px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: TONES.blue.bg, border: `1px solid ${TONES.blue.bd}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck style={{ width: '24px', height: '24px', color: TONES.blue.fg }} />
              </div>
              <div>
                <h1 style={{ color: T.heading, fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>Verify it's you</h1>
                <p style={{ color: T.muted, fontSize: '13px', lineHeight: 1.5 }}>
                  Enter the 6-digit code from your authenticator app for <strong style={{ color: T.body }}>{email.trim()}</strong>
                </p>
              </div>
            </div>
          )}

          {error && (
            <div key={errorKey} role="alert" className="login-alert">
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {!otpStep ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="login-email" className="login-label">Work email</label>
                  <div className="login-field">
                    <Mail className="login-field-icon" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@company.com"
                      aria-invalid={emailInvalid}
                      className={`login-input${emailInvalid ? ' is-invalid' : ''}`}
                      style={{ paddingRight: '42px' }}
                    />
                    {emailValid && (
                      <CheckCircle2 className="login-field-end" style={{ color: TONES.green.fg }} aria-hidden="true" />
                    )}
                  </div>
                  {emailInvalid && <p className="login-hint is-error">Enter a valid email, like name@company.com</p>}
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
                      onKeyDown={checkCaps}
                      onKeyUp={checkCaps}
                      onBlur={() => setCapsOn(false)}
                      placeholder="Enter your password"
                      className="login-input"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="login-eye"
                    >
                      {showPw ? <EyeOff style={{ width: '17px', height: '17px' }} /> : <Eye style={{ width: '17px', height: '17px' }} />}
                    </button>
                  </div>
                  {capsOn && (
                    <p className="login-hint is-warn">
                      <KeyRound style={{ width: '13px', height: '13px' }} /> Caps Lock is on
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="login-otp-row" onPaste={handleOtpPaste}>
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
                      disabled={loading}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      className={`login-otp${digit ? ' is-filled' : ''}${i === 2 ? ' is-split' : ''}`}
                    />
                  ))}
                </div>

                <div className="login-timer">
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="11" cy="11" r="9" fill="none" stroke={T.border} strokeWidth="2.5" />
                    <circle
                      cx="11" cy="11" r="9" fill="none"
                      stroke={secondsLeft <= 5 ? TONES.amber.bd : '#66BB6A'}
                      strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 9}
                      strokeDashoffset={2 * Math.PI * 9 * (1 - ringPct)}
                      transform="rotate(-90 11 11)"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span>
                    Code refreshes in <strong style={{ color: secondsLeft <= 5 ? TONES.amber.fg : T.body }}>{secondsLeft}s</strong> · paste it or type it, it submits on its own
                  </span>
                </div>

                <button type="button" onClick={backToLogin} className="login-back">
                  <ArrowLeft style={{ width: '14px', height: '14px' }} />
                  Use a different account
                </button>
              </>
            )}

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? (
                <>
                  <Loader2 className="login-spin" style={{ width: '17px', height: '17px' }} />
                  {otpStep ? 'Verifying…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {otpStep ? 'Verify & continue' : 'Sign in'}
                  <ArrowRight className="login-submit-arrow" style={{ width: '17px', height: '17px' }} />
                </>
              )}
            </button>
          </form>

          <div className="login-card-foot">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck style={{ width: '14px', height: '14px' }} />
              Secured connection
            </span>
            <span className="login-kbd-hint">Press <kbd>Enter ↵</kbd> to continue</span>
            <span className="login-version">v{APP_VERSION}</span>
          </div>
        </div>
      </main>
    </div>
  );
};

/* Pseudo-classes, keyframes and breakpoints can't be inline styles, so the
   page keeps them here, scoped by the login- prefix. Colours are theme.js
   values; the brand panel's whites sit on green that clears 4.5:1. */
const LOGIN_CSS = `
.login-root {
  width: 100vw; height: 100vh; overflow-y: auto;
  display: flex; font-family: Inter, system-ui, sans-serif;
  background:
    radial-gradient(700px 500px at 100% 0%, rgba(165, 214, 167, 0.35), transparent 60%),
    radial-gradient(600px 400px at 30% 100%, rgba(200, 230, 201, 0.45), transparent 60%),
    ${T.page};
}

/* Brand panel */
.login-brand {
  position: relative; overflow: hidden;
  flex: 0 0 50%; max-width: 760px; min-height: 100%;
  color: #FFFFFF;
  background: linear-gradient(155deg, #2E7D32 0%, #1B5E20 50%, #0F3A13 100%);
}
.login-grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%);
          mask-image: radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%);
}
.login-orb { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; }
.login-orb-a {
  width: 420px; height: 420px; top: -120px; left: -80px;
  background: rgba(102, 187, 106, 0.55); animation: login-float 14s ease-in-out infinite;
}
.login-orb-b {
  width: 360px; height: 360px; bottom: -120px; right: -100px;
  background: rgba(165, 214, 167, 0.35); animation: login-float 18s ease-in-out infinite reverse;
}
.login-brand-inner {
  position: relative; z-index: 1; height: 100%; min-height: 640px;
  display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
  padding: 40px 56px;
}
.login-mark-tile {
  width: 46px; height: 46px; border-radius: 13px; background: #FFFFFF;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 22px -10px rgba(0,0,0,0.45);
}
.login-glass-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.24);
  backdrop-filter: blur(6px);
}
.login-eyebrow {
  font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  color: #C8E6C9; margin-bottom: 14px;
}
.login-headline {
  font-size: clamp(32px, 3.4vw, 46px); line-height: 1.1; font-weight: 800;
  letter-spacing: -0.8px; margin-bottom: 18px;
}
.login-headline-accent {
  background: linear-gradient(90deg, #E8F5E9, #A5D6A7 60%, #C8E6C9);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
/* Form side */
.login-main {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 40px 16px;
}
.login-card {
  width: 100%; max-width: 440px; padding: 32px 36px 22px;
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 22px;
  box-shadow: ${LIFT}, 0 30px 60px -40px rgba(27, 94, 32, 0.35);
}
.login-mobile-brand { display: none; align-items: center; gap: 10px; margin-bottom: 22px; }
.login-steps {
  list-style: none; display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
  font-size: 12px; font-weight: 600; color: ${T.faint};
}
.login-steps li { display: flex; align-items: center; gap: 8px; }
.login-step-dot {
  width: 22px; height: 22px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  background: ${T.bg}; border: 1px solid ${T.border}; color: ${T.faint};
  transition: all .25s;
}
.login-steps li.is-active { color: ${T.heading}; }
.login-steps li.is-active .login-step-dot { background: ${T.heading}; border-color: ${T.heading}; color: #FFFFFF; }
.login-steps li.is-done { color: ${TONES.green.fg}; }
.login-steps li.is-done .login-step-dot { background: ${TONES.green.bg}; border-color: ${TONES.green.bd}; color: ${TONES.green.fg}; }
.login-steps .login-step-line { flex: 1; height: 1px; background: ${T.border}; max-width: 60px; }

.login-label { display: block; font-size: 13px; font-weight: 600; color: ${T.body}; margin-bottom: 8px; }
.login-field { position: relative; }
.login-field-icon {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  width: 17px; height: 17px; color: ${T.faint}; pointer-events: none; transition: color .15s;
}
.login-field:focus-within .login-field-icon { color: ${T.heading}; }
.login-field-end {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  width: 17px; height: 17px; animation: login-pop .25s ease both;
}
.login-input {
  width: 100%; height: 48px; padding: 0 14px 0 42px;
  background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 12px;
  color: ${T.heading}; font-size: 14.5px; outline: none;
  transition: border-color .15s, box-shadow .15s, background-color .15s;
}
.login-input::placeholder { color: ${T.faint}; opacity: 1; }
.login-input:hover { border-color: ${T.borderHi}; }
.login-input:focus { background: ${T.surface}; border-color: #66BB6A; box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2); }
.login-input.is-invalid { border-color: ${TONES.red.fg}; box-shadow: 0 0 0 4px rgba(183, 28, 28, 0.1); }
.login-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 7px; animation: login-slide-in .2s ease both; }
.login-hint.is-error { color: ${TONES.red.fg}; }
.login-hint.is-warn {
  color: ${TONES.amber.fg}; background: ${TONES.amber.bg}; border: 1px solid ${TONES.amber.bd};
  padding: 4px 9px; border-radius: 8px; width: fit-content; font-weight: 600;
}
.login-eye {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  display: inline-flex; padding: 7px; border-radius: 8px;
  background: none; border: none; color: ${T.faint}; cursor: pointer;
}
.login-eye:hover { color: ${T.heading}; background: ${T.raised}; }

.login-alert {
  display: flex; align-items: center; gap: 8px; padding: 12px 14px; margin-bottom: 18px;
  border-radius: 12px; font-size: 13px;
  color: ${TONES.red.fg}; background: ${TONES.red.bg}; border: 1px solid ${TONES.red.bd};
  animation: login-shake .4s ease both;
}

.login-otp-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; }
.login-otp {
  width: 50px; height: 58px; text-align: center; font-size: 24px; font-weight: 700;
  color: ${T.heading}; background: ${T.bg}; border: 2px solid ${T.border};
  border-radius: 12px; outline: none; caret-color: ${T.heading};
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.login-otp.is-split { margin-right: 10px; }
.login-otp.is-filled { border-color: ${T.borderHi}; background: ${T.surface}; animation: login-pop .2s ease; }
.login-otp:focus { border-color: #66BB6A; box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2); transform: translateY(-2px); }
.login-otp:disabled { opacity: .6; }
.login-timer {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 12px; color: ${T.muted}; margin-bottom: 18px; text-align: left;
}
.login-back {
  display: flex; align-items: center; gap: 6px; margin: 0 auto 16px; padding: 0;
  background: none; border: none; color: ${T.muted}; font-size: 13px; cursor: pointer;
}
.login-back:hover { color: ${T.heading}; }

.login-submit {
  width: 100%; height: 50px; border: none; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: ${T.accentGradient}; color: #FFFFFF; font-size: 15px; font-weight: 700;
  cursor: pointer; box-shadow: 0 12px 24px -12px rgba(27, 94, 32, 0.75);
  transition: transform .15s, box-shadow .15s, opacity .2s;
}
.login-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 16px 28px -12px rgba(27, 94, 32, 0.85); }
.login-submit:hover:not(:disabled) .login-submit-arrow { transform: translateX(4px); }
.login-submit-arrow { transition: transform .2s; }
.login-submit:active:not(:disabled) { transform: translateY(0); }
.login-submit:focus-visible { outline: 3px solid #66BB6A; outline-offset: 2px; }
.login-submit:disabled { opacity: .75; cursor: progress; }

.login-card-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  margin-top: 24px; padding-top: 16px; border-top: 1px solid ${T.border};
  font-size: 12px; color: ${T.faint};
}
.login-card-foot kbd {
  font-family: inherit; font-size: 11px; font-weight: 600; color: ${T.body};
  padding: 1px 6px; border-radius: 5px; background: ${T.bg}; border: 1px solid ${T.border};
  border-bottom-width: 2px;
}
.login-version {
  font-weight: 700; color: ${TONES.indigo.fg}; background: ${TONES.indigo.bg};
  border: 1px solid ${TONES.indigo.bd}; padding: 2px 9px; border-radius: 999px;
}

.login-spin { animation: login-spin .8s linear infinite; }
.login-rise { animation: login-rise .6s cubic-bezier(.2,.7,.2,1) both; }

@keyframes login-spin { to { transform: rotate(360deg); } }
@keyframes login-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes login-slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes login-pop { 0% { transform: scale(.85); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes login-shake { 0%,100% { transform: none; } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
@keyframes login-float { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px, 30px); } }

@media (max-width: 1000px) {
  .login-brand { display: none; }
  .login-mobile-brand { display: flex; }
}
@media (max-width: 480px) {
  .login-card { padding: 24px 20px 18px; border-radius: 18px; }
  .login-otp-row { gap: 6px; }
  .login-otp { width: 40px; height: 50px; font-size: 20px; }
  .login-otp.is-split { margin-right: 6px; }
  .login-kbd-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .login-root *, .login-root *::before, .login-root *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;

export default Login;
