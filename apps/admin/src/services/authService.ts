// Privity Authentication & User Profile Management Service
// Full Supabase Cloud Auth Integration with Sovereign Local Fallback
// Guarantees all new users begin from absolute zero (Level 0, 0 followers, 0 following, 0 likes, 0 sparks)

import { getSupabaseClient, saveSupabaseAnonKey, isSupabaseConfigured, SUPABASE_PROJECT_ID } from './supabaseClient';

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
  provider: 'supabase' | 'google' | 'email' | 'guest';
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

export function mapSupabaseUserToAccount(sbUser: any): UserAccount {
  const meta = sbUser.user_metadata || {};
  const email = (sbUser.email || '').toLowerCase().trim();
  const rawHandle = meta.handle || email.split('@')[0] || `user_${sbUser.id.slice(0, 5)}`;
  const cleanHandle = rawHandle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const name = meta.name || meta.full_name || (cleanHandle ? cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1) : 'Member');
  const avatar = meta.avatar || meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanHandle || sbUser.id)}`;

  return {
    id: sbUser.id,
    name,
    handle: cleanHandle,
    email,
    avatar,
    coverUrl: meta.coverUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
    bio: meta.bio || '',
    level: 0,
    xp: 0,
    followers: 0,
    following: 0,
    likes: 0,
    sparks: 0,
    isVerified: false,
    createdAt: new Date(sbUser.created_at || Date.now()).getTime(),
    provider: (sbUser.app_metadata?.provider as any) || 'supabase',
  };
}

class AuthService {
  private currentUser: UserAccount | null = null;
  private listeners: Set<(user: UserAccount | null) => void> = new Set();
  public isGoogleSdkLoaded = false;
  private isSupabaseListenerAttached = false;

  constructor() {
    this.loadSession();
    this.initSupabaseListener();
  }

  // Initialize Supabase Auth listener
  public initSupabaseListener() {
    if (this.isSupabaseListenerAttached) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    this.isSupabaseListenerAttached = true;

    // Check active Supabase session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!error && session?.user) {
        const account = mapSupabaseUserToAccount(session.user);
        this.setSession(account);
      }
    }).catch((e) => {
      console.warn('[Supabase Auth] getSession error:', e);
    });

    // Subscribe to Supabase auth events
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const account = mapSupabaseUserToAccount(session.user);
        this.setSession(account);
      } else if (event === 'SIGNED_OUT') {
        this.setSession(null);
      }
    });
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

  // Check if Supabase backend is configured and ready
  public isSupabaseReady(): boolean {
    return isSupabaseConfigured();
  }

  public getSupabaseProjectId(): string {
    return SUPABASE_PROJECT_ID;
  }

  public setSupabaseKey(key: string) {
    saveSupabaseAnonKey(key);
    this.isSupabaseListenerAttached = false;
    this.initSupabaseListener();
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

    const baseHandle = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();

    const accounts = this.getAllAccounts();
    let existing = Object.values(accounts).find(
      (a) => a.email.toLowerCase() === email || a.id === `google_${payload.sub}`
    );

    if (existing) {
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

  // Supabase Async Sign Up (with local sovereign fallback)
  public async signUpAsync(data: {
    name: string;
    handle: string;
    email: string;
    password?: string;
    avatar?: string;
  }): Promise<UserAccount> {
    const cleanHandle = data.handle.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();

    if (!cleanHandle) throw new Error('Please choose a valid username / handle');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address');
    if (!cleanName) throw new Error('Please enter your full name');

    const defaultAvatar =
      data.avatar ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`;

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: res, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password || 'Privity@2026',
        options: {
          data: {
            name: cleanName,
            handle: cleanHandle,
            avatar: defaultAvatar,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (res.user) {
        const account = mapSupabaseUserToAccount(res.user);
        this.setSession(account);
        return account;
      }
    }

    // Sovereign fallback if Supabase not yet keyed
    return this.signUp(data);
  }

  // Synchronous Email/Password Sign Up
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

  // Supabase Async Login (with local sovereign fallback)
  public async loginAsync(identifier: string, password?: string): Promise<UserAccount> {
    const clean = identifier.trim().toLowerCase().replace(/^@/, '');
    const cleanEmail = clean.includes('@') ? clean : `${clean}@privity.app`;

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: res, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password || 'Privity@2026',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (res.user) {
        const account = mapSupabaseUserToAccount(res.user);
        this.setSession(account);
        return account;
      }
    }

    return this.login(identifier, password);
  }

  // Synchronous Log In fallback
  public login(identifier: string, _password?: string): UserAccount {
    const clean = identifier.trim().toLowerCase().replace(/^@/, '');
    const accounts = this.getAllAccounts();

    const found = Object.values(accounts).find(
      (a) => a.handle.toLowerCase() === clean || a.email.toLowerCase() === clean
    );

    if (found) {
      this.setSession(found);
      return found;
    }

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

  // Supabase Google OAuth
  public async loginWithGoogleOAuth(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
    }
  }

  // Update current user profile
  public updateProfile(updates: Partial<UserAccount>): UserAccount {
    if (!this.currentUser) throw new Error('No user is currently signed in');
    const updated: UserAccount = {
      ...this.currentUser,
      ...updates,
    };
    this.setSession(updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.updateUser({
        data: {
          name: updated.name,
          handle: updated.handle,
          avatar: updated.avatar,
          coverUrl: updated.coverUrl,
          bio: updated.bio,
        },
      }).catch((e) => console.warn('Supabase updateUser error:', e));
    }

    return updated;
  }

  // Log out current session
  public async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
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
