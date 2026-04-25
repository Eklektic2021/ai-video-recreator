import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface Props {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="authguard-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="authguard-center">
        <div className="authguard-card">
          <div className="authguard-brand">
            <span className="header-logo">MAISuite Flow</span>
            <span className="header-sep">|</span>
            <span className="header-title">AI Video Recreator</span>
          </div>

          <h1 className="authguard-title">Welcome back</h1>
          <p className="authguard-desc">
            Sign in with your Google account to continue.
          </p>

          <button
            className="authguard-google-btn"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            <svg className="authguard-google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>

          {error && <p className="authguard-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="authguard-user-bar">
        <img
          className="authguard-avatar"
          src={user.photoURL ?? ''}
          alt={user.displayName ?? 'User'}
          referrerPolicy="no-referrer"
        />
        <span className="authguard-display-name">{user.displayName}</span>
        <button className="authguard-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
