import React, { useState, useEffect, useRef } from 'react';
import './authModal.css';
import { authService, UserAccount } from '../../services/authService';
import { getSupabaseAnonKey, getGoogleClientId } from '../../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthenticated: (user: UserAccount) => void;
  requireAuth?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  requireAuth = false,
}) => {
  const [tab, setTab] = useState<'login' | 'signup'>('signup');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleManualName, setGoogleManualName] = useState('');
  const [googleManualEmail, setGoogleManualEmail] = useState('');
  const [googleManualPhoto, setGoogleManualPhoto] = useState('');

  // Supabase Configuration Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [isSupabaseReady, setIsSupabaseReady] = useState(() => authService.isSupabaseReady());

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsSupabaseReady(authService.isSupabaseReady());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Optional environment Google Client ID
    const clientId = getGoogleClientId();
    if (clientId) {
      authService.initGoogleIdentity(clientId, (credential) => {
        try {
          const user = authService.handleGoogleCredential(credential);
          onAuthenticated(user);
          onClose?.();
        } catch (err: any) {
          setErrorMsg(err.message || 'Google sign-in failed');
        }
      });

      if (googleBtnContainerRef.current) {
        authService.renderGoogleButton(googleBtnContainerRef.current);
      }
    }
  }, [isOpen, onAuthenticated, onClose]);

  if (!isOpen) return null;

  const handleNativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (tab === 'signup') {
        const user = await authService.signUpAsync({
          name: name.trim(),
          handle: handle.trim(),
          email: email.trim(),
          password,
          avatar: avatarUrl || undefined,
        });
        onAuthenticated(user);
        onClose?.();
      } else {
        const user = await authService.loginAsync(handle || email, password);
        onAuthenticated(user);
        onClose?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleGoogleClick = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (authService.isSupabaseReady()) {
        await authService.loginWithGoogleOAuth();
        return;
      }

      const clientId = getGoogleClientId();
      if (clientId && (window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.prompt();
        return;
      }

      setIsGoogleModalOpen(true);
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setErrorMsg(err.message || 'Google sign-in error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmGoogleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleManualEmail.trim() || !googleManualEmail.includes('@')) {
      setErrorMsg('Please enter a valid Google email address');
      return;
    }
    const realGoogleName = googleManualName.trim() || googleManualEmail.split('@')[0];
    const realGooglePhoto =
      googleManualPhoto.trim() ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(googleManualEmail.trim())}`;
    const cleanHandle = googleManualEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();

    setIsLoading(true);
    try {
      const user = await authService.signUpAsync({
        name: realGoogleName,
        handle: cleanHandle,
        email: googleManualEmail.trim(),
        avatar: realGooglePhoto,
      });

      setIsGoogleModalOpen(false);
      onAuthenticated(user);
      onClose?.();
    } catch {
      const user = authService.handleGoogleCredential({
        sub: 'google_usr_' + Math.random().toString(36).substring(2, 9),
        name: realGoogleName,
        email: googleManualEmail.trim(),
        picture: realGooglePhoto,
      });

      setIsGoogleModalOpen(false);
      onAuthenticated(user);
      onClose?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSupabaseKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (supabaseKeyInput.trim()) {
      authService.setSupabaseKey(supabaseKeyInput.trim());
      setIsSupabaseReady(true);
      setIsConfigModalOpen(false);
      setSupabaseKeyInput('');
      setErrorMsg(null);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={requireAuth ? undefined : onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {!requireAuth && onClose && (
          <button
            type="button"
            className="auth-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div className="auth-brand-badge">
          <span>🛡️ Privity Authentic Identity</span>
        </div>

        {/* Supabase Status Pill */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          {isSupabaseReady ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
              }}
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
              <span>Supabase Cloud Active ({authService.getSupabaseProjectId()})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSupabaseKeyInput(getSupabaseAnonKey());
                setIsConfigModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                cursor: 'pointer',
              }}
              title="Click to connect Supabase Anon Public Key"
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} />
              <span>⚡ Connect Supabase Cloud Key</span>
            </button>
          )}
        </div>

        <h2 className="auth-header-title">
          {tab === 'signup' ? 'Create Sovereign Account' : 'Welcome Back'}
        </h2>
        <p className="auth-header-sub">
          {tab === 'signup'
            ? 'Sign up to start fresh with absolute 0-level stats, private circles, and zero algorithm games.'
            : 'Log in to continue your dispatches and sovereign broadcasts.'}
        </p>

        {errorMsg && (
          <div className="auth-error-banner">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. GOOGLE SIGN IN */}
        <div className="google-auth-section">
          <div ref={googleBtnContainerRef} id="g_id_signin_wrap" />

          <button
            type="button"
            className="google-identity-btn"
            onClick={handleGoogleClick}
            disabled={isLoading}
          >
            <svg className="google-icon-svg" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">Or with credentials</span>
          <div className="auth-divider-line" />
        </div>

        {/* 2. MODE SWITCH: SIGN UP / LOG IN */}
        <div className="auth-mode-switch">
          <button
            type="button"
            className={`auth-mode-btn ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setErrorMsg(null); }}
            disabled={isLoading}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`auth-mode-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setErrorMsg(null); }}
            disabled={isLoading}
          >
            Sign In
          </button>
        </div>

        {/* 3. NATIVE / SUPABASE FORM */}
        <form onSubmit={handleNativeSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                className="auth-input"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Username / Handle</label>
            <input
              type="text"
              className="auth-input"
              placeholder={tab === 'signup' ? 'e.g. alexmorgan' : 'Your @handle or email'}
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))}
              required
              disabled={isLoading}
            />
          </div>

          {tab === 'signup' && (
            <div className="auth-input-group">
              <label className="auth-label">Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="e.g. user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={tab === 'signup'}
              disabled={isLoading}
            />
          </div>

          {tab === 'signup' && (
            <div className="auth-input-group">
              <label className="auth-label">Profile Photo (Optional)</label>
              <div className="auth-avatar-row">
                <img
                  src={
                    avatarUrl ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${handle || 'user'}`
                  }
                  alt="Avatar Preview"
                  className="auth-avatar-preview"
                />
                <button
                  type="button"
                  className="auth-avatar-pick-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  Upload Photo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleAvatarFile}
                />
              </div>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading
              ? 'Connecting to Supabase...'
              : tab === 'signup'
              ? 'Create Account & Begin at 0 🚀'
              : 'Sign In 🔑'}
          </button>
        </form>

        {/* 4. SUPABASE CONFIGURATION MODAL */}
        {isConfigModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100001,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '440px',
                background: '#151926',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '24px',
                color: '#fff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Connect Supabase Project</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                Your project ID is <strong>{authService.getSupabaseProjectId()}</strong>. Paste your project&apos;s <strong>anon</strong> public key below from your Supabase dashboard:
              </p>

              <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dashboard URL:</span><br />
                <a
                  href={`https://supabase.com/dashboard/project/${authService.getSupabaseProjectId()}/settings/api`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  Project Settings &gt; API &gt; anon public key
                </a>
              </div>

              <form onSubmit={handleSaveSupabaseKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Supabase Anon Public Key (starts with eyJ...)
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '11px', borderRadius: '999px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Save & Connect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. GOOGLE MODAL POPUP (Direct Google Connector) */}
        {isGoogleModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100000,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '380px',
                background: '#1e2438',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '24px',
                color: '#fff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <svg className="google-icon-svg" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Connect Google Account</h3>
              </div>

              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, margin: '0 0 16px 0' }}>
                Enter your Google Account details so the entire platform reflects your real Google name and photo.
              </p>

              <form onSubmit={handleConfirmGoogleAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Google Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@gmail.com"
                    value={googleManualEmail}
                    onChange={(e) => setGoogleManualEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Google Display Name</label>
                  <input
                    type="text"
                    placeholder="Your Google Name"
                    value={googleManualName}
                    onChange={(e) => setGoogleManualName(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Google Photo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://lh3.googleusercontent.com/..."
                    value={googleManualPhoto}
                    onChange={(e) => setGoogleManualPhoto(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsGoogleModalOpen(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '11px', borderRadius: '999px', background: 'linear-gradient(135deg, #4285f4, #34a853)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Sign In Now
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await authService.loginWithGoogleOAuth();
                      } catch (err: any) {
                        setErrorMsg(err.message || 'Google OAuth failed');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    title="Requires Google provider enabled in your Supabase Auth Providers dashboard"
                  >
                    Or use Supabase OAuth Redirect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="auth-info-tip">
          💡 <strong>Zero-Level Guarantee:</strong> Every user starts at Level 0 with 0 followers, 0 following, and 0 likes. You build your real reputation organically.
        </div>
      </div>
    </div>
  );
};
