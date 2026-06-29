import { Stack } from "expo-router";
import { SessionProvider, useSession } from "../context/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Animated } from "react-native";
import * as SplashScreen from 'expo-splash-screen';
import "../../global.css";

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading } = useSession();
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  // Animated values for fade-in and fade-out
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Step 1: As soon as we mount, hide the tiny native splash and fade IN our custom one
  useEffect(() => {
    SplashScreen.hideAsync();

    // Fade the custom splash screen IN smoothly over 600ms
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Step 2: Once the app is truly done loading, fade OUT and reveal the app
  useEffect(() => {
    if (!isLoading) {
      // Minimum 1.5s visible AFTER the app has loaded (not a fixed 2s timer)
      const timer = setTimeout(() => {
        // Fade the custom splash screen OUT smoothly over 500ms
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          // Only hide AFTER the fade-out animation is completely done
          setShowCustomSplash(false);
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (showCustomSplash) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('../../assets/images/logo-glow.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootLayoutNav />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: '95%',
    height: '65%',
  },
});
