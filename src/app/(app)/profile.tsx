import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../context/auth';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { API_URL } from '../../config';

export default function ProfileScreen() {
  const {
    signOut,
    user,
    updateProfile,
    uploadProfileImage,
    biometricsEnabled,
    setBiometricsEnabled
  } = useSession();
  const router = useRouter();

  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const typeStrings = types.map(type => {
        if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Fingerprint';
        if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
        if (type === LocalAuthentication.AuthenticationType.IRIS) return 'Iris';
        return 'Biometric';
      });
      setSupportedTypes(typeStrings);
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Reduced quality for faster sync
    });

    if (!result.canceled) {
      try {
        setIsUpdating(true);
        await uploadProfileImage(result.assets[0].uri);
      } catch (error) {
        alert('Failed to upload profile picture to server');
      } finally {
        setIsUpdating(false);
      }
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" color="#f8fafc" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {user?.profile_image ? (
                <Image 
                  source={{ uri: user.profile_image.startsWith('http') ? user.profile_image : `${API_URL}${user.profile_image}` }} 
                  style={styles.avatar} 
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" color="#38bdf8" size={48} />
                </View>
              )}
              <TouchableOpacity
                style={styles.changePictureButton}
                onPress={pickImage}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="camera-outline" color="white" size={18} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{user?.full_name || 'Explorer'}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" color="#38bdf8" size={14} />
              <Text style={styles.verifiedText}>Verified Account</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Account Info</Text>
            <BlurView intensity={20} tint="dark" style={styles.card}>
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="mail-outline" color="#94a3b8" size={20} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user?.email || 'No email provided'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="shield-outline" color="#94a3b8" size={20} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Account Status</Text>
                  <Text style={[styles.infoValue, { color: '#38bdf8' }]}>Active & Protected</Text>
                </View>
              </View>
            </BlurView>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Security</Text>
            <BlurView intensity={20} tint="dark" style={styles.card}>
              <View style={styles.securityItem}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    {supportedTypes.includes('Face ID') ? (
                      <Ionicons name="shield-checkmark-outline" color="#38bdf8" size={20} />
                    ) : (
                      <Ionicons name="finger-print-outline" color="#38bdf8" size={20} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>Biometric Security</Text>
                    <Text style={styles.infoValue}>
                      {supportedTypes.length > 0 ? supportedTypes.join(' & ') : 'Not Supported'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={setBiometricsEnabled}
                  trackColor={{ false: '#334155', true: '#0ea5e9' }}
                  thumbColor={biometricsEnabled ? '#f8fafc' : '#94a3b8'}
                />
              </View>
            </BlurView>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.signOutButton]}
              onPress={() => signOut()}
            >
              <Ionicons name="log-out-outline" color="#f43f5e" size={22} />
              <Text style={[styles.actionButtonText, styles.signOutText]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 24,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  changePictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#38bdf8',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1e293b',
  },
  userName: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  verifiedText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  infoSection: {
    marginBottom: 32,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 20,
  },
  actionSection: {
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 18,
    borderRadius: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
    borderColor: 'rgba(244, 63, 94, 0.1)',
  },
  signOutText: {
    color: '#f43f5e',
  },
});
