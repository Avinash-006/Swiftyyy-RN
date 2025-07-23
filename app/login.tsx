import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  KeyboardAvoidingView,
  ScrollView,
  useColorScheme,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import config from './config'; // Ensure config.js exports { url: 'your-api-url' }

interface LoginData {
  username: string | null;
  email: string | null;
  password: string;
}

interface UserData {
  id: string;
  username: string;
  isAdmin: boolean;
}

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = useMemo(() => colorScheme === 'dark', [colorScheme]);
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [remember, setRemember] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  const passwordInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBounce = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const bgAnim1 = useRef(new Animated.Value(0)).current;
  const bgAnim2 = useRef(new Animated.Value(0)).current;
  const bgAnim3 = useRef(new Animated.Value(0)).current;
  const bgAnim4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Load remembered credentials
    const loadCredentials = async () => {
      try {
        const credentials = await AsyncStorage.getItem('rememberedCredentials');
        if (credentials) {
          const { email: savedEmail, password: savedPassword } = JSON.parse(credentials);
          setEmail(savedEmail || '');
          setPassword(savedPassword || '');
          setRemember(true);
        }
      } catch (error) {
        console.error('Failed to load credentials:', error);
      }
    };
    loadCredentials();

    // Animation setup
    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const cardScaleAnim = Animated.spring(cardScale, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    });

    const inputBounceAnim = Animated.sequence([
      Animated.timing(inputBounce, {
        toValue: 8,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(inputBounce, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]);

    const bgLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim1, {
          toValue: 80,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgAnim1, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const bgLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim2, {
          toValue: -80,
          duration: 10000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgAnim2, {
          toValue: 0,
          duration: 10000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const bgLoop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim3, {
          toValue: 60,
          duration: 9000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgAnim3, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const bgLoop4 = Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim4, {
          toValue: -60,
          duration: 11000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgAnim4, {
          toValue: 0,
          duration: 11000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    fadeIn.start();
    cardScaleAnim.start();
    inputBounceAnim.start();
    bgLoop1.start();
    bgLoop2.start();
    bgLoop3.start();
    bgLoop4.start();

    // Cleanup animations
    return () => {
      bgLoop1.stop();
      bgLoop2.stop();
      bgLoop3.stop();
      bgLoop4.stop();
    };
  }, [fadeAnim, cardScale, inputBounce, bgAnim1, bgAnim2, bgAnim3, bgAnim4]);

  const validateInputs = (): boolean => {
    let isValid = true;
    const errors: { email?: string; password?: string } = {};

    if (!email) {
      errors.email = 'Username or email required';
      isValid = false;
    }
    if (!password) {
      errors.password = 'Password required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setEmailError(errors.email || '');
    setPasswordError(errors.password || '');
    return isValid;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateInputs()) return;

    if (!config?.url) {
      Toast.show({
        type: 'error',
        text1: 'Configuration Error',
        text2: 'API URL is not defined',
      });
      return;
    }

    setLoading(true);
    try {
      const isEmailInput = email.includes('@');
      const loginData: LoginData = {
        username: isEmailInput ? null : email,
        email: isEmailInput ? email : null,
        password,
      };
      const response = await axios.post(`${config.url}/api/users/login`, loginData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const user: UserData = response.data;

      if (user?.id && user.username) {
        await AsyncStorage.setItem('user', JSON.stringify({
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
        }));
        if (remember) {
          await AsyncStorage.setItem('rememberedCredentials', JSON.stringify({ email, password }));
        } else {
          await AsyncStorage.removeItem('rememberedCredentials');
        }
        Toast.show({
          type: 'success',
          text1: 'Welcome aboard!',
          text2: `Logged in as ${user.username}`,
        });
        router.replace('/pass-share');
      } else {
        throw new Error('Invalid user data');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Sign-in failed. Please try again!';
      Toast.show({
        type: 'error',
        text1: 'Oops!',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleButtonPressIn = (): void => {
    Animated.spring(buttonScale, {
      toValue: 0.94,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = (): void => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const renderTextInput = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    error: string,
    secureTextEntry?: boolean,
    keyboardType: 'default' | 'email-address' | 'numeric' = 'default',
    inputRef?: React.RefObject<TextInput>,
    onSubmitEditing?: () => void,
    returnKeyType?: 'next' | 'go' | 'done'
  ) => (
    <Animated.View style={{ transform: [{ translateY: inputBounce }] }}>
      <View style={[styles.inputContainer, error && styles.inputContainerError]}>
        <MaterialCommunityIcons
          name={secureTextEntry ? 'lock' : 'email'}
          size={18}
          color={isDark ? '#0A84FF' : '#007AFF'}
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.input, isDark ? styles.inputDark : styles.inputLight, error && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          keyboardType={keyboardType}
          selectionColor={isDark ? '#0A84FF' : '#007AFF'}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={false}
          accessibilityLabel={placeholder}
          accessibilityHint={secureTextEntry ? 'Enter your password' : 'Enter your username or email'}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
            activeOpacity={0.7}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              color={isDark ? '#0A84FF' : '#007AFF'}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </Animated.View>
  );

  const renderSubmitButton = () => (
    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity
        style={[
          styles.submitButton,
          isDark ? styles.buttonDark : styles.buttonLight,
          loading && styles.disabledButton,
        ]}
        onPress={handleSubmit}
        onPressIn={handleButtonPressIn}
        onPressOut={handleButtonPressOut}
        disabled={loading}
        activeOpacity={0.7}
        accessibilityLabel="Sign in button"
        accessibilityHint="Tap to sign in"
      >
        <View style={styles.buttonInner}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Sign In</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const themedBackground = isDark ? '#000000' : '#F2F2F7';
  const { width } = Dimensions.get('window');
  const isTablet = width >= 700;

  return (
    <View style={[styles.root, { backgroundColor: themedBackground }]}>
      {/* Animated Background Bubbles */}
      <Animated.View
        style={[
          styles.bgShape1,
          {
            transform: [{ translateX: bgAnim1 }, { translateY: bgAnim1 }],
            opacity: isDark ? 0.12 : 0.08,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bgShape2,
          {
            transform: [{ translateX: bgAnim2 }, { translateY: bgAnim2 }],
            opacity: isDark ? 0.12 : 0.08,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bgShape3,
          {
            transform: [{ translateX: bgAnim3 }, { translateY: bgAnim3 }],
            opacity: isDark ? 0.12 : 0.08,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bgShape4,
          {
            transform: [{ translateX: bgAnim4 }, { translateY: bgAnim4 }],
            opacity: isDark ? 0.12 : 0.08,
          },
        ]}
      />
      <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? insets.top + 48 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent' }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[isTablet && styles.cardContainerTablet]}>
              <View
                style={[
                  styles.card,
                  isDark ? styles.cardDark : styles.cardLight,
                  isTablet && { maxWidth: 400 },
                ]}
              >
                <View style={styles.header}>
                  <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
                    Welcome Back
                  </Text>
                  <Text style={[styles.subtitle, isDark && { color: '#8E8E93' }]}>
                    Sign in to access your files
                  </Text>
                </View>
                <View style={styles.form}>
                  {renderTextInput(
                    email,
                    setEmail,
                    'Username or Email',
                    emailError,
                    false,
                    'email-address',
                    undefined,
                    () => passwordInputRef.current?.focus(),
                    'next'
                  )}
                  {renderTextInput(
                    password,
                    setPassword,
                    'Password',
                    passwordError,
                    !showPassword,
                    'default',
                    passwordInputRef,
                    handleSubmit,
                    'done'
                  )}
                  <View style={styles.optionsContainer}>
                    <View style={styles.switchContainer}>
                      <Switch
                        value={remember}
                        onValueChange={setRemember}
                        trackColor={{
                          false: isDark ? '#3A3A3C' : '#E5E5EA',
                          true: isDark ? '#0A84FF' : '#007AFF',
                        }}
                        thumbColor={isDark ? '#FFFFFF' : '#FFFFFF'}
                        ios_backgroundColor={isDark ? '#3A3A3C' : '#E5E5EA'}
                        accessibilityLabel="Stay signed in toggle"
                        accessibilityHint="Toggle to stay signed in"
                      />
                      <Text style={[styles.rememberMeText, isDark && { color: '#8E8E93' }]}>
                        Stay Signed In
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push('/forgot-password')}
                      accessibilityLabel="Forgot password link"
                      accessibilityHint="Tap to reset your password"
                    >
                      <Text
                        style={[styles.forgotPassword, isDark && { color: isIOS ? '#0A84FF' : '#60A5FA' }]}
                      >
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {renderSubmitButton()}
                </View>
                <View style={styles.footer}>
                  <Text style={[styles.footerText, isDark && { color: '#8E8E93' }]}>
                    New here?{' '}
                    <Text
                      style={[styles.signupLink, isDark && { color: isIOS ? '#0A84FF' : '#60A5FA' }]}
                      onPress={() => router.push('/register')}
                    >
                      Sign Up
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      <Toast />
      <View style={{ height: insets.bottom, backgroundColor: 'transparent' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bgShape1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Platform.OS === 'ios' ? '#007AFF' : '#2563EB',
    top: '8%',
    left: '-6%',
  },
  bgShape2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Platform.OS === 'ios' ? '#0A84FF' : '#60A5FA',
    bottom: '12%',
    right: '-2%',
  },
  bgShape3: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Platform.OS === 'ios' ? '#007AFF' : '#2563EB',
    top: '20%',
    right: '8%',
  },
  bgShape4: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Platform.OS === 'ios' ? '#0A84FF' : '#60A5FA',
    bottom: '25%',
    left: '10%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardContainerTablet: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  card: {
    borderRadius: 24,
    padding: 30,
    marginVertical: 32,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: {
        backgroundColor: '#FFFFFF',
        elevation: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
    }),
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
  },
  form: {
    gap: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: Platform.select({
      ios: '#F2F2F7',
      android: '#F5F5F5',
    }),
    borderWidth: 1,
    borderColor: Platform.select({
      ios: '#E5E5EA',
      android: '#E0E0E0',
    }),
  },
  inputContainerError: {
    borderColor: '#FF3B30',
    borderWidth: Platform.OS === 'ios' ? 1 : 2,
  },
  inputIcon: {
    marginLeft: 18,
    marginRight: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 22,
    paddingHorizontal: 16,
    fontSize: 20,
    borderRadius: 16,
    fontWeight: '400',
  },
  inputLight: {
    backgroundColor: Platform.select({
      ios: '#F2F2F7',
      android: '#F5F5F5',
    }),
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: Platform.OS === 'ios' ? 0 : 2,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 10,
    marginLeft: 18,
    fontWeight: '400',
  },
  eyeIcon: {
    padding: 18,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rememberMeText: {
    color: '#8E8E93',
    fontSize: 17,
    fontWeight: '400',
  },
  forgotPassword: {
    color: Platform.select({
      ios: '#007AFF',
      android: '#2563EB',
    }),
    fontSize: 17,
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  buttonInner: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.select({
      ios: '#007AFF',
      android: '#2563EB',
    }),
  },
  buttonLight: {
    backgroundColor: Platform.select({
      ios: '#007AFF',
      android: '#2563EB',
    }),
  },
  buttonDark: {
    backgroundColor: Platform.select({
      ios: '#0A84FF',
      android: '#60A5FA',
    }),
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  footer: {
    marginTop: 36,
    alignItems: 'center',
  },
  footerText: {
    color: '#8E8E93',
    fontSize: 17,
    fontWeight: '400',
  },
  signupLink: {
    color: Platform.select({
      ios: '#007AFF',
      android: '#2563EB',
    }),
    fontWeight: '600',
  },
});