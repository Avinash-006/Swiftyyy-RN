// index.tsx (FrontPage/Onboarding Screen)
// Place this component as your splash/landing Index screen in your app entrypoint.
// Assumes "@expo/vector-icons/MaterialCommunityIcons", "react-native-toast-message", and "AsyncStorage" are installed.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useColorScheme,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function Index() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';

  const router = useRouter();
  const [hide, setHide] = useState<boolean>(false);

  // Only show if user installs for the first time
  useEffect(() => {
    (async () => {
      const alreadyOnboarded = await AsyncStorage.getItem('hasOnboarded');
      if (alreadyOnboarded) {
        setHide(true);
        router.replace('/login');
      }
    })();
  }, []);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/login');
  };

  if (hide) return null;

  // Responsive sizing
  const width = Dimensions.get('window').width;
  const iconSize = width > 350 ? 105 : 75;

  return (
    <View style={[
      styles.root,
      { backgroundColor: isDark ? '#181824' : isIOS ? '#f6f5fa' : '#0a0a0a' }
    ]}>
      <View style={styles.centerContent}>
        <MaterialCommunityIcons
          name="space-invaders"
          size={iconSize}
          color={isDark ? '#8ab4f8' : '#007AFF'}
          style={{ marginBottom: 40 }}
        />
        <Text style={[
          styles.title,
          isDark
            ? { color: '#fff', fontFamily: isIOS ? 'System' : 'Roboto' }
            : { color: isIOS ? '#111' : '#fff', fontFamily: isIOS ? 'System' : 'Roboto' }
        ]}>
          Welcome to SpaceShare
        </Text>
        <Text style={[
          styles.subtitle,
          isDark
            ? { color: '#bababa' }
            : { color: isIOS ? '#687088' : '#d1d5db' }
        ]}>
          Share files, safely—across the universe.
        </Text>
        <TouchableOpacity
          style={[
            styles.button,
            isDark
              ? (isIOS ? styles.iosButtonDark : styles.androidButtonDark)
              : (isIOS ? styles.iosButtonLight : styles.androidButtonLight)
          ]}
          activeOpacity={0.82}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 28,
  },
  title: {
    fontSize: 29,
    fontWeight: 'bold',
    marginBottom: 9,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 38,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 210,
    marginTop: 30,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 7,
  },
  iosButtonLight: {
    backgroundColor: '#007AFF',
  },
  iosButtonDark: {
    backgroundColor: '#8ab4f8',
  },
  androidButtonLight: {
    backgroundColor: '#3B82F6',
  },
  androidButtonDark: {
    backgroundColor: '#8ab4f8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.54,
  }
});
