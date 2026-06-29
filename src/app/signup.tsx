import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../context/auth';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../config';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const calculatePasswordStrength = (pass: string) => {
    if (pass.length === 0) return { score: 0, label: '', color: '#94a3b8' };
    if (pass.length < 8) return { score: 1, label: 'Weak', color: '#f43f5e' };

    const hasNumbers = /\d/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);

    let strength = 1;
    strength++; // Minimum length score bump
    if (hasNumbers && hasSpecial) strength++;
    if (hasUpper) strength++;

    if (strength === 2) return { score: 2, label: 'Fair', color: '#fbbf24' };
    if (strength === 3) return { score: 3, label: 'Good', color: '#38bdf8' };
    return { score: 4, label: 'Strong', color: '#22c55e' };
  };

  const strength = calculatePasswordStrength(password);
  const { signIn } = useSession();
  const router = useRouter();

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (!/\d/.test(password)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert('Weak Password', 'Password must contain at least one number.');
      return;
    }

    if (password !== confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert('Mismatched Passwords', 'Passwords do not match.');
      return;
    }

    if (!agreeToTerms) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert('Terms Agreement Required', 'Please agree to the Terms & Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        await signIn(data.access_token, data.user);
        router.replace('/(app)');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        Alert.alert('Sign Up Failed', data.detail || 'Sign up failed. Please try again.');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Alert.alert('Connection Error', 'Could not connect to the server. Please ensure the Python backend is running.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/logo-glow.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join our community of enthusiasts</Text>
            </View>

            <View style={styles.form}>
              <View style={[styles.inputWrapper, isLoading && styles.inputWrapperDisabled]}>
                <Ionicons name="person-outline" size={20} color={isLoading ? "#475569" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  placeholder="Full Name"
                  placeholderTextColor="#64748b"
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputWrapper, isLoading && styles.inputWrapperDisabled]}>
                <Ionicons name="mail-outline" size={20} color={isLoading ? "#475569" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#64748b"
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputWrapper, isLoading && styles.inputWrapperDisabled]}>
                <Ionicons name="lock-closed-outline" size={20} color={isLoading ? "#475569" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#64748b"
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <Ionicons name="eye-off-outline" size={20} color="#94a3b8" />
                  ) : (
                    <Ionicons name="eye-outline" size={20} color="#94a3b8" />
                  )}
                </TouchableOpacity>
              </View>

              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarWrapper}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i <= strength.score ? strength.color : 'rgba(148, 163, 184, 0.1)' }
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}

              <View style={[styles.inputWrapper, isLoading && styles.inputWrapperDisabled]}>
                <Ionicons name="lock-closed-outline" size={20} color={isLoading ? "#475569" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  placeholder="Confirm Password"
                  placeholderTextColor="#64748b"
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <Ionicons name="eye-off-outline" size={20} color="#94a3b8" />
                  ) : (
                    <Ionicons name="eye-outline" size={20} color="#94a3b8" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.termsContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <View style={[
                  styles.checkbox,
                  agreeToTerms && styles.checkboxActive,
                  isLoading && styles.checkboxDisabled
                ]}>
                  {agreeToTerms && <Ionicons name="checkmark-circle" size={14} color={isLoading ? "#475569" : "white"} />}
                </View>
                <Text style={[styles.termsText, isLoading && styles.textDisabled]}>
                  I agree to the <Text style={[styles.termsLink, isLoading && styles.textDisabled]}>Terms</Text> & <Text style={[styles.termsLink, isLoading && styles.textDisabled]}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#38bdf8', '#0ea5e9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Sign Up</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialContainer}>
              <TouchableOpacity
                style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
                onPress={() => Alert.alert('Coming Soon', 'Social signup with Google coming soon.')}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={24} color={isLoading ? "#475569" : "#f8fafc"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
                onPress={() => Alert.alert('Coming Soon', 'Social signup with Apple coming soon.')}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={24} color={isLoading ? "#475569" : "#f8fafc"} />
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()} disabled={isLoading}>
                <Text style={[styles.signInText, isLoading && styles.textDisabled]}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    paddingHorizontal: 16,
    height: 60,
  },
  inputWrapperDisabled: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderColor: 'rgba(51, 65, 85, 0.25)',
  },
  inputDisabled: {
    color: '#475569',
  },
  inputIcon: {
    marginRight: 12,
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  socialButtonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.5,
  },
  strengthContainer: {
    marginBottom: 20,
  },
  strengthBarWrapper: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  checkboxDisabled: {
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  termsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  termsLink: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  textDisabled: {
    color: '#475569',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
    gap: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 0,
  },
  eyeIcon: {
    padding: 8,
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 16,
  },
  button: {
    height: 60,
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  signInText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700',
  },
});
