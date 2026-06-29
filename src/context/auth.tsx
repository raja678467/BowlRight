import { createContext, useContext, useEffect, useState, useRef, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL, WS_URL } from '../config';
import * as LocalAuthentication from 'expo-local-authentication';

interface User {
  id: string;
  email: string;
  full_name?: string | null;
  profile_image?: string | null;
  is_admin: boolean;
}

interface AuthContextType {
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  uploadProfileImage: (uri: string) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  session?: string | null;
  user: User | null;
  biometricsEnabled: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  signIn: async () => { },
  signOut: async () => { },
  updateProfile: async () => { },
  uploadProfileImage: async () => { },
  setBiometricsEnabled: async () => { },
  loginWithBiometrics: async () => { },
  session: null,
  user: null,
  biometricsEnabled: false,
  isLoading: true,
});

export function useSession() {
  const value = useContext(AuthContext);
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('useSession must be wrapped in a <SessionProvider />');
    }
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const isProcessingBiometrics = useRef(false);

  const isLoadingStorage = useRef(false);

  useEffect(() => {
    const loadStorage = async () => {
      if (isLoadingStorage.current) return;
      isLoadingStorage.current = true;

      try {
        const [token, userJson, biometrics] = await Promise.all([
          SecureStore.getItemAsync('session'),
          SecureStore.getItemAsync('user'),
          SecureStore.getItemAsync('biometricsEnabled'),
        ]);

        if (token) {
          // Verify if the session is still valid with the backend
          try {
            const response = await fetch(`${API_URL}/me`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const freshUser = await response.json();
              setSession(token);
              setUser(freshUser);
              await SecureStore.setItemAsync('user', JSON.stringify(freshUser));
            } else {
              // Token expired or invalid
              console.warn('Session expired, logging out');
              await signOut();
            }
          } catch (fetchError) {
            console.error('Network error during session verification', fetchError);
            setSession(token);
            if (userJson) setUser(JSON.parse(userJson));
          }
        }
        
        setBiometricsEnabled(biometrics === 'true');
      } catch (e) {
        console.error('Failed to load storage', e);
      } finally {
        setIsLoading(false);
        isLoadingStorage.current = false;
      }
    };
    loadStorage();

    // Listen for AppState changes to re-verify session when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadStorage();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Phase 3 Hardened WebSocket Logic
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const connect = () => {
      if (!session || !user?.id || !isMounted) return;
      
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      
      // 1. Move token to Subprotocol to prevent log leaks in server logs
      const url = `${WS_URL}/ws/${user.id}`;
      const protocols = ['access_token', session]; 
      
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[WS] Secured connection established');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = async (e) => {
        const message = e.data;
        if (message === 'PING') {
          ws.send('PONG');
          return;
        }

        if (message === 'LOGOUT') {
          console.warn('[WS] Remote termination signal received');
          Alert.alert('Session Ended', 'Your account session has been terminated.');
          signOut();
          // Server will close the connection, but we help it out
          ws.close();
        } else if (message === 'SYNC') {
          try {
            const response = await fetch(`${API_URL}/me`, {
              headers: { 'Authorization': `Bearer ${session}` }
            });
            if (response.ok) {
              const freshUser = await response.json();
              setUser(freshUser);
              await SecureStore.setItemAsync('user', JSON.stringify(freshUser));
            }
          } catch (err) {
            console.error('[WS] Sync failed', err);
          }
        }
      };

      ws.onclose = (e) => {
        if (!isMounted) return;
        wsRef.current = null;
        
        if (session) {
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
          const jitter = Math.random() * 1000;
          
          console.log(`[WS] Reconnecting in ${Math.round((delay + jitter) / 1000)}s...`);
          
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              reconnectAttemptsRef.current++;
              connect();
            }
          }, delay + jitter);
        }
      };

      ws.onerror = () => {
        // Handled by onclose
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [session, user?.id]);

  const signOut = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('session'),
        SecureStore.deleteItemAsync('user'),
      ]);
      setSession(null);
      setUser(null);
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };

  const signIn = async (token: string, userData: User) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync('session', token),
        SecureStore.setItemAsync('user', JSON.stringify(userData)),
      ]);
      setSession(token);
      setUser(userData);
    } catch (e) {
      console.error('Sign in failed', e);
      throw e;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!session || !user) return;

    try {
      const response = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.status === 401) {
        await signOut();
        throw new Error('Session expired. Please log in again.');
      }
      
      if (!response.ok) throw new Error('Failed to sync profile');

      const updatedUser = await response.json();
      const newUser = { ...user, ...updatedUser };
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      setUser(newUser);
    } catch (e) {
      console.error('Update profile failed', e);
      throw e;
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!session || !user) return;

    try {
      const formData = new FormData();
      
      const fileToUpload = {
        uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any; // React Native FormData requires 'as any' for the file object

      formData.append('file', fileToUpload);

      const response = await fetch(`${API_URL}/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        await signOut();
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) throw new Error('Failed to upload image');

      const data = await response.json();
      const newUser = { ...user, profile_image: data.image_url };
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      setUser(newUser);
    } catch (e) {
      console.error('Upload failed', e);
      throw e;
    }
  };

  const handleBiometricsEnabled = async (enabled: boolean) => {
    if (isProcessingBiometrics.current) return;
    isProcessingBiometrics.current = true;

    if (enabled) {
      if (!session) {
        isProcessingBiometrics.current = false;
        return;
      }
      try {
        const response = await fetch(`${API_URL}/biometrics/enable`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to enable biometrics on server');
        }

        const data = await response.json();

        if (data.biometric_secret) {
          await SecureStore.setItemAsync('biometricSecret', String(data.biometric_secret), {
            requireAuthentication: true,
          });
          await SecureStore.setItemAsync('biometricsEnabled', 'true');
          setBiometricsEnabled(true);
        } else {
          throw new Error('No biometric secret received from server');
        }
      } catch (e: any) {
        // If the user cancelled the biometric prompt, don't show an error alert
        if (e.message.includes('canceled') || e.message.includes('Cancel')) {
          setBiometricsEnabled(false);
          return;
        }
        
        if (e.message.includes('Lockout') || e.message.includes('lockout')) {
          alert('Too many attempts. Please wait 15 seconds or unlock your device with your PIN to reset biometrics.');
          return;
        }

        console.error('Failed to enable biometrics', e);
        alert(e.message || 'Could not enable biometrics');
        setBiometricsEnabled(false);
      } finally {
        isProcessingBiometrics.current = false;
      }
    } else {
      try {
        await SecureStore.deleteItemAsync('biometricSecret');
        await SecureStore.setItemAsync('biometricsEnabled', 'false');
        setBiometricsEnabled(false);
      } finally {
        isProcessingBiometrics.current = false;
      }
    }
  };

  const loginWithBiometrics = async () => {
    if (isProcessingBiometrics.current) return;
    isProcessingBiometrics.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        throw new Error('Biometric authentication is not set up on this device');
      }

      // 1. Retrieve the secret. This call WILL trigger the OS biometric prompt
      // because we saved it with 'requireAuthentication: true'.
      const secret = await SecureStore.getItemAsync('biometricSecret');
      
      if (!secret) {
        throw new Error('Biometrics not enabled for this account. Please log in with your password first.');
      }

      // 2. Send the secret to the server to get a fresh session token
      const response = await fetch(`${API_URL}/biometrics/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biometric_secret: secret }),
      });

      if (!response.ok) {
        // If the server rejects the secret, the local state is out of sync or expired.
        await SecureStore.deleteItemAsync('biometricSecret');
        await SecureStore.setItemAsync('biometricsEnabled', 'false');
        setBiometricsEnabled(false);
        throw new Error('Biometric credentials expired or invalid. Please log in with your password and re-enable biometrics.');
      }

      const data = await response.json();
      await signIn(data.access_token, data.user);
    } catch (e: any) {
      // If the user cancelled the biometric prompt, don't show an error alert
      if (e.message.includes('cancel') || e.message.includes('Cancel')) {
        return;
      }

      if (e.message.includes('Lockout') || e.message.includes('lockout')) {
        alert('Too many attempts. Please wait 15 seconds or unlock your device with your PIN to reset biometrics.');
        return;
      }

      console.error('Biometric login failed', e);
      alert(e.message || 'Biometric login failed');
    } finally {
      isProcessingBiometrics.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        updateProfile,
        uploadProfileImage,
        setBiometricsEnabled: handleBiometricsEnabled,
        loginWithBiometrics,
        session,
        user,
        biometricsEnabled,
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
