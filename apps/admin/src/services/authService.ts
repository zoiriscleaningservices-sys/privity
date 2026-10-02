// Privity Authentication & User Profile Management Service
// Supports Google Sign-In (real Google name, email, profile picture) & Email/Password Sign Up
// Guarantees all new users begin from absolute zero (0 level, 0 followers, 0 following, 0 likes, 0 sparks)

export interface UserAccount {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  coverUrl?: string;
  bio?: string;
  level: number;
  xp: number;
  followers: number;
  following: number;
  likes: number;
  sparks: number;
  isVerified?: boolean;
  createdAt: number;
  provider: 'google' | 'email' | 'guest';
}

export interface GoogleJwtPayload {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture: string;
  email: string;
  email_verified?: boolean;
}

const STORAGE_SESSION_KEY = 'privity_auth_session_v1';
const STORAGE_ACCOUNTS_KEY = 'privity_accounts_v1';

class AuthService {
  private currentUser: UserAccount | null = null;
  private listeners: Set<(user: UserAccount | null) => void> = new Set();
  public isGoogleSdkLoaded = false;

  constructor() {
    this.loadSession();
  }

  // Reactive subscription
  public subscribe(callback: (user: UserAccount | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentUser);
      } catch (e) {
        console.error('Auth listener error:', e);
      }
    });
  }

  private loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        this.currentUser = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load auth session:', e);
      this.currentUser = null;
    }
  }

  public getCurrentUser(): UserAccount | null {
    if (!this.currentUser) {
      this.loadSession();
    }
    return this.currentUser;
  }

  // Get all registered accounts on device
  public getAllAccounts(): Record<string, UserAccount> {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private saveAccounts(accounts: Record<string, UserAccount>) {
    try {
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn('Failed to save accounts to storage:', e);
    }
  }

  private setSession(user: UserAccount | null) {
    this.currentUser = user;
    if (user) {
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
        // Also sync to accounts
        const accounts = this.getAllAccounts();
        accounts[user.handle.toLowerCase()] = user;
        this.saveAccounts(accounts);
      } catch (e) {
        console.warn('Failed to save auth session:', e);
      }
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
    this.notify();
  }

  // Parse Google JWT ID Token without requiring third-party library
  public decodeGoogleJwt(credential: string): GoogleJwtPayload | null {
    try {
      const parts = credential.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error decoding Google JWT:', e);
      return null;
    }
  }

  // Sign in or Sign up via Google Account Credential
  public handleGoogleCredential(credentialOrPayload: string | GoogleJwtPayload): UserAccount {
    const payload: GoogleJwtPayload | null =
      typeof credentialOrPayload === 'string'
        ? this.decodeGoogleJwt(credentialOrPayload)
        : credentialOrPayload;

    if (!payload || !payload.email) {
      throw new Error('Invalid Google credential payload');
    }

    const email = payload.email.toLowerCase().trim();
    const googleName = payload.name || payload.given_name || 'Google User';
    const googleAvatar =
      payload.picture ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`;

    // Generate clean unique handle from email prefix
    const baseHandle = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();

    const accounts = this.getAllAccounts();
    // Check if account already exists
    let existing = Object.values(accounts).find(
      (a) => a.email.toLowerCase() === email || a.id === `google_${payload.sub}`
    );

    if (existing) {
      // Update with latest real Google profile name & photo
      const updated: UserAccount = {
        ...existing,
        name: googleName,
        avatar: googleAvatar,
      };
      this.setSession(updated);
      return updated;
    }

    // New Google User: Strictly starts at Level 0, 0 stats!
    const newAccount: UserAccount = {
      id: `google_${payload.sub || Date.now()}`,
      name: googleName,
      handle: baseHandle,
      email,
      avatar: googleAvatar,
      coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
      bio: '',
      level: 0,
      xp: 0,
      followers: 0,
      following: 0,
      likes: 0,
      sparks: 0,
      isVerified: false,
      createdAt: Date.now(),
      provider: 'google',
    };

    this.setSession(newAccount);
    return newAccount;
  }

  // Native Email/Password Sign Up
  public signUp(data: {
    name: string;
    handle: string;
    email: string;
    password?: string;
    avatar?: string;
  }): UserAccount {
    const cleanHandle = data.handle.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();

    if (!cleanHandle) throw new Error('Please choose a valid username / handle');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address');
    if (!cleanName) throw new Error('Please enter your full name');

    const accounts = this.getAllAccounts();
    if (accounts[cleanHandle]) {
      throw new Error(`Username @${cleanHandle} is already taken. Please choose another.`);
    }

    const defaultAvatar =
      data.avatar ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`;

    // New User Account: Starts at Level 0, 0 stats!
    const newAccount: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      handle: cleanHandle,
      email: cleanEmail,
      avatar: defaultAvatar,
      coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
      bio: '',
      level: 0,
      xp: 0,
      followers: 0,
      following: 0,
      likes: 0,
      sparks: 0,
      isVerified: false,
      createdAt: Date.now(),
      provider: 'email',
    };

    this.setSession(newAccount);
    return newAccount;
  }

  // Native Log In
  public login(identifier: string, _password?: string): UserAccount {
    const clean = identifier.trim().toLowerCase().replace(/^@/, '');
    const accounts = this.getAllAccounts();

    // Find by handle or email
    const found = Object.values(accounts).find(
      (a) => a.handle.toLowerCase() === clean || a.email.toLowerCase() === clean
    );

    if (found) {
      this.setSession(found);
      return found;
    }

    // If identifier doesn't exist yet, create a fresh Level 0 session for them
    const freshUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name: clean.charAt(0).toUpperCase() + clean.slice(1),
      handle: clean,
      email: `${clean}@privity.app`,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${clean}`,
      coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
      bio: '',
      level: 0,
      xp: 0,
      followers: 0,
      following: 0,
      likes: 0,
      sparks: 0,
      isVerified: false,
      createdAt: Date.now(),
      provider: 'email',
    };

    this.setSession(freshUser);
    return freshUser;
  }

  // Update current user profile
  public updateProfile(updates: Partial<UserAccount>): UserAccount {
    if (!this.currentUser) throw new Error('No user is currently signed in');
    const updated: UserAccount = {
      ...this.currentUser,
      ...updates,
    };
    this.setSession(updated);
    return updated;
  }

  // Log out current session
  public logout() {
    this.setSession(null);
  }

  // Initialize official Google Identity Services client
  public initGoogleIdentity(
    clientId: string,
    onSuccess: (credential: string) => void
  ) {
    if (typeof window === 'undefined') return;

    const initializeGsi = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: (res: any) => {
              if (res && res.credential) {
                onSuccess(res.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          this.isGoogleSdkLoaded = true;
        } catch (e) {
          console.warn('Google Identity initialize error:', e);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      initializeGsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGsi;
      document.head.appendChild(script);
    }
  }

  // Render official Google button into DOM element
  public renderGoogleButton(
    container: HTMLElement,
    options?: { theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; text?: string }
  ) {
    if ((window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.renderButton(container, {
          theme: options?.theme || 'outline',
          size: options?.size || 'large',
          text: options?.text || 'continue_with',
          shape: 'pill',
          width: 320,
        });
      } catch (e) {
        console.warn('Could not render Google button:', e);
      }
    }
  }
}

export const authService = new AuthService();
