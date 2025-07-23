import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import axios, { AxiosError } from 'axios';
import Toast from 'react-native-toast-message';
import config from './config'; // Adjust path if needed

type RegisterForm = {
  username: string;
  email: string;
  password: string;
};

export default function Register() {
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof RegisterForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Type guard for AxiosError with response property
  function hasAxiosResponse(error: unknown): error is AxiosError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error
    );
  }

  const handleSubmit = async () => {
    setLoading(true);

    if (!formData.username || !formData.email || !formData.password) {
      Toast.show({
        type: 'error',
        text1: 'All fields are required',
      });
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${config.url}/api/users/add`, formData);
      Toast.show({
        type: 'success',
        text1: 'Registration successful! Please login.',
      });
      navigation.navigate('login');
    } catch (err: unknown) {
      let errorMessage = 'An error occurred';

      // Type-safe Axios response checking
      if (hasAxiosResponse(err)) {
        const axiosError = err as AxiosError;
        if (typeof axiosError.response?.data === 'string') {
          errorMessage = axiosError.response.data;
        } else if (
          axiosError.response?.data &&
          typeof axiosError.response.data === 'object' &&
          'message' in axiosError.response.data
        ) {
          errorMessage = (axiosError.response.data as any).message;
        }
        if (axiosError.response?.status === 409) {
          if (typeof errorMessage === 'string' && errorMessage.includes('Username')) {
            errorMessage = 'Username is already taken';
          } else if (typeof errorMessage === 'string' && errorMessage.includes('Email')) {
            errorMessage = 'Email is already taken';
          }
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      Toast.show({ type: 'error', text1: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Platform and theme-aware styles
  const inputTheme = isDark
    ? isIOS
      ? styles.inputIosDark
      : styles.inputAndroidDark
    : isIOS
    ? styles.inputIosLight
    : styles.inputAndroidLight;

  const cardTheme = isDark
    ? isIOS
      ? styles.cardIosDark
      : styles.cardAndroidDark
    : isIOS
    ? styles.cardIosLight
    : styles.cardAndroidLight;

  const buttonTheme = isDark
    ? isIOS
      ? styles.iosButtonDark
      : styles.androidButtonDark
    : isIOS
    ? styles.iosButtonLight
    : styles.androidButtonLight;

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { backgroundColor: isDark ? '#181824' : isIOS ? '#f6f5fa' : '#0a0a0a' },
      ]}
      behavior={isIOS ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, cardTheme]}>
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                isDark
                  ? { color: '#fff', fontFamily: isIOS ? 'System' : 'Roboto' }
                  : { color: isIOS ? '#111' : '#fff', fontFamily: isIOS ? 'System' : 'Roboto' },
              ]}
            >
              Create Account
            </Text>
            <Text
              style={[
                styles.subtitle,
                isDark
                  ? { color: '#bababa' }
                  : { color: isIOS ? '#697a91' : '#b1b1b1' },
              ]}
            >
              Join our secure file sharing platform
            </Text>
          </View>
          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="account"
                size={22}
                color={isDark ? '#8ab4f8' : isIOS ? '#007AFF' : '#9CA3AF'}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Username"
                value={formData.username}
                onChangeText={(val) => handleChange('username', val)}
                style={[styles.input, inputTheme]}
                placeholderTextColor={isDark ? '#A3A3A3' : '#9CA3AF'}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />
            </View>
            {/* Email */}
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="email"
                size={22}
                color={isDark ? '#8ab4f8' : isIOS ? '#007AFF' : '#9CA3AF'}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Email address"
                value={formData.email}
                onChangeText={(val) => handleChange('email', val)}
                style={[styles.input, inputTheme]}
                placeholderTextColor={isDark ? '#A3A3A3' : '#9CA3AF'}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>
            {/* Password */}
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="lock"
                size={22}
                color={isDark ? '#8ab4f8' : isIOS ? '#007AFF' : '#9CA3AF'}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Password"
                value={formData.password}
                onChangeText={(val) => handleChange('password', val)}
                style={[styles.input, inputTheme]}
                placeholderTextColor={isDark ? '#A3A3A3' : '#9CA3AF'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={isDark ? '#8ab4f8' : isIOS ? '#007AFF' : '#9CA3AF'}
                />
              </TouchableOpacity>
            </View>
            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.button, buttonTheme, loading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.linkRow}>
            <Text style={[styles.linkText, isDark && { color: '#bababa' }]}>
              Already have an account?{' '}
              <Text
                style={[styles.link, { color: isIOS ? '#007AFF' : '#3b82f6' }]}
                onPress={() => navigation.navigate('login')}
              >
                Sign in
              </Text>
            </Text>
          </View>
        </View>
        <Toast />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- STYLES ----
const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    padding: 18,
    width: '100%',
  },
  card: {
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginVertical: 24,
  },
  cardIosLight: {
    backgroundColor: '#fff',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  cardIosDark: {
    backgroundColor: '#23243A',
    shadowColor: '#111',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  cardAndroidLight: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    elevation: 10,
  },
  cardAndroidDark: {
    backgroundColor: '#23243A',
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 2,
    textAlign: 'center',
  },
  form: {
    marginTop: 4,
    marginBottom: 10,
    gap: 18,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    marginBottom: 5,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    marginTop: -11,
    zIndex: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: 48,
    paddingVertical: 0,
    paddingLeft: 46,
    paddingRight: 46,
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  inputIosLight: {
    borderColor: '#e1e1e5',
    backgroundColor: '#fff',
    borderRadius: 10,
    color: '#111',
    fontFamily: 'System',
  },
  inputIosDark: {
    borderColor: '#3a4158',
    backgroundColor: '#24243e',
    borderRadius: 10,
    color: '#fff',
    fontFamily: 'System',
  },
  inputAndroidLight: {
    borderColor: '#2c3452',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    color: '#fff',
    fontFamily: 'Roboto',
  },
  inputAndroidDark: {
    borderColor: '#444b6e',
    backgroundColor: '#1a1a24',
    borderRadius: 10,
    color: '#fff',
    fontFamily: 'Roboto',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -11,
    zIndex: 10,
    padding: 4,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iosButtonLight: {
    backgroundColor: '#007AFF',
  },
  iosButtonDark: {
    backgroundColor: '#8ab4f8',
  },
  androidButtonLight: {
    backgroundColor: '#2563eb',
  },
  androidButtonDark: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  linkRow: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: '#7b8494',
    fontSize: 14,
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
