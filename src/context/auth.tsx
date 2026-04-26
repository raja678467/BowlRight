import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import * as LocalAuthentication from 'expo-local-authentication';

interface User {
  email: string;
  full_name?: string | null;
  profile_image?: string | null;
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

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const [token, userJson, biometrics] = await Promise.all([
          SecureStore.getItemAsync('session'),
          SecureStore.getItemAsync('user'),
          SecureStore.getItemAsync('biometricsEnabled'),
        ]);

        setSession(token);
        if (userJson) {
          setUser(JSON.parse(userJson));
        }
        setBiometricsEnabled(biometrics === 'true');
      } catch (e) {
        console.error('Failed to load storage', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorage();
  }, []);

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
      // @ts-ignore
      formData.append('file', {
        uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`${API_URL}/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
        },
        body: formData,
      });

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
    if (enabled) {
      if (!session) return;
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
        console.error('Failed to enable biometrics', e);
        alert(e.message || 'Could not enable biometrics');
      }
    } else {
      await SecureStore.deleteItemAsync('biometricSecret');
      await SecureStore.setItemAsync('biometricsEnabled', 'false');
      setBiometricsEnabled(false);
    }
  };

  const loginWithBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) throw new Error('Biometrics not supported');

      const secret = await SecureStore.getItemAsync('biometricSecret');
      if (!secret) throw new Error('Biometrics not enabled for this account');

      const results = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with Biometrics',
      });

      if (results.success) {
        const response = await fetch(`${API_URL}/biometrics/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ biometric_secret: secret }),
        });

        if (!response.ok) throw new Error('Biometric login failed on server');

        const data = await response.json();
        await signIn(data.access_token, data.user);
      }
    } catch (e: any) {
      console.error('Biometric login failed', e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut: async () => {
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
        },
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
