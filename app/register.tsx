// register.tsx (Register Screen)
// Assumes "@expo/vector-icons/MaterialCommunityIcons", "react-native-toast-message", "AsyncStorage", and "expo-linear-gradient" are installed.

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios, { AxiosError } from 'axios';
import Toast from 'react-native-toast-message';
import config from './config'; // Adjust path if needed
import { LinearGradient } from 'expo-linear-gradient';

type RegisterForm = {
  username: string;
  email: string;
  password: string;
};

export default function Register() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBounce = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  // Animation values for twinkling stars
  const starOpacity1 = new Animated.Value(0.3);
  const starOpacity2 = new Animated.Value(0.8);
  const starOpacity3 = new Animated.Value(0.5);
  const starOpacity4 = new Animated.Value(0.4);
  const starOpacity5 = new Animated.Value(0.7);
  const starOpacity6 = new Animated.Value(0.6);

  useEffect(() => {
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

    // Star twinkling animation
    const createTwinkleAnimation = (opacity: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1500,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.2,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = createTwinkleAnimation(starOpacity1, 0);
    const animation2 = createTwinkleAnimation(starOpacity2, 500);
    const animation3 = createTwinkleAnimation(starOpacity3, 1000);
    const animation4 = createTwinkleAnimation(starOpacity4, 1500);
    const animation5 = createTwinkleAnimation(starOpacity5, 2000);
    const animation6 = createTwinkleAnimation(starOpacity6, 2500);

    animation1.start();
    animation2.start();
    animation3.start();
    animation4.start();
    animation5.start();
    animation6.start();

    fadeIn.start();
    cardScaleAnim.start();
    inputBounceAnim.start();

    // Cleanup animations
    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
      animation4.stop();
      animation5.stop();
      animation6.stop();
    };
  }, [fadeAnim, cardScale, inputBounce, starOpacity1, starOpacity2, starOpacity3, starOpacity4, starOpacity5, starOpacity6]);

  // Type guard for AxiosError with response property
  function hasAxiosResponse(error: unknown): error is AxiosError {
    return typeof error === 'object' && error !== null && 'isAxiosError' in error;
  }

  const validateInputs = (): boolean => {
    let isValid = true;
    const errors: { username?: string; email?: string; password?: string } = {};

    if (!formData.username) {
      errors.username = 'Username is required';
      isValid = false;
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
      isValid = false;
    }

    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Invalid email format';
      isValid = false;
    }

    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setUsernameError(errors.username || '');
    setEmailError(errors.email || '');
    setPasswordError(errors.password || '');
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) {
      setLoading(false);
      return;
    }

    if (!config?.url) {
      Toast.show({
        type: 'error',
        text1: 'Configuration Error',
        text2: 'API URL is not defined',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${config.url}/api/users/add`, formData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'Please sign in to continue.',
      });
      navigation.navigate('login');
    } catch (err: unknown) {
      let errorMessage = 'Registration failed. Please try again!';
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
            setUsernameError(errorMessage);
          } else if (typeof errorMessage === 'string' && errorMessage.includes('Email')) {
            errorMessage = 'Email is already taken';
            setEmailError(errorMessage);
          }
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
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

  // Handles input changes for username, email, and password
  const handleChange = (field: keyof RegisterForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderTextInput = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    error: string,
    iconName: string,
    secureTextEntry: boolean = false,
    keyboardType: 'default' | 'email-address' | 'numeric' = 'default',
    inputRef?: React.RefObject<TextInput>,
    onSubmitEditing?: () => void,
    returnKeyType: 'next' | 'go' | 'done' = 'next'
  ) => {
    const containerStyles = [
      styles.inputContainer,
      error && styles.inputContainerError,
      Platform.select({
        ios: styles.inputContainerIOS,
        android: styles.inputContainerAndroid,
      }),
    ];

    const inputStyles = [
      styles.input,
      Platform.select({
        ios: styles.inputIOS,
        android: styles.inputAndroid,
      }),
    ];

    return (
      <Animated.View style={{ transform: [{ translateY: inputBounce }] }}>
        <View style={containerStyles}>
          <MaterialCommunityIcons
            name={iconName as any}
            size={scale(20)}
            color={'#FFFFFF'}
            style={styles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={inputStyles}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={'#A0A0A0'}
            secureTextEntry={secureTextEntry}
            autoCapitalize="none"
            keyboardType={keyboardType}
            selectionColor={'#FFFFFF'}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={false}
            accessibilityLabel={placeholder}
            accessibilityHint={secureTextEntry ? 'Enter your password' : `Enter your ${placeholder.toLowerCase()}`}
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
                size={scale(20)}
                color={'#FFFFFF'}
              />
            </TouchableOpacity>
          )}
        </View>
        {error ? <Text style={[styles.errorText, { fontSize: scale(14), marginTop: scale(8), marginLeft: scale(16) }]}>{error}</Text> : null}
      </Animated.View>
    );
  };

  const renderSubmitButton = () => (
    <Animated.View style={{ transform: [{ scale: buttonScale }], zIndex: 20 }}>
      <TouchableOpacity
        style={[
          styles.submitButton,
          { borderRadius: scale(Platform.OS === 'ios' ? 12 : 8), paddingVertical: scale(16), marginTop: scale(30) },
          loading && styles.disabledButton,
        ]}
        onPress={handleSubmit}
        onPressIn={handleButtonPressIn}
        onPressOut={handleButtonPressOut}
        disabled={loading}
        activeOpacity={0.7}
        accessibilityLabel="Create account button"
        accessibilityHint="Tap to create your account"
      >
        <View style={styles.buttonInner}>
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={[styles.submitButtonText, { fontSize: scale(18) }]}>Create Account</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const { width } = Dimensions.get('window');
  const scale = (size: number) => Math.min(width / 414, 1) * size;
  const imageSize = scale(105);

  return (
    <View style={styles.root}>
      {/* Stars container */}
      <View style={[styles.starsContainer, { zIndex: 1 }]}>
        <Animated.View style={[styles.star, { top: '15%', left: '20%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.star, { top: '25%', right: '15%', opacity: starOpacity2 }]} />
        <Animated.View style={[styles.star, { top: '35%', left: '10%', opacity: starOpacity3 }]} />
        <Animated.View style={[styles.star, { top: '45%', right: '25%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.star, { top: '20%', left: '60%', opacity: starOpacity2 }]} />
        <Animated.View style={[styles.star, { top: '40%', left: '80%', opacity: starOpacity3 }]} />
        <Animated.View style={[styles.star, { top: '10%', right: '40%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.star, { top: '30%', left: '40%', opacity: starOpacity2 }]} />
        <Animated.View style={[styles.star, { top: '50%', right: '10%', opacity: starOpacity3 }]} />
        <Animated.View style={[styles.star, { top: '15%', left: '75%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.star, { top: '8%', left: '5%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '12%', right: '8%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '18%', left: '45%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '22%', right: '50%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '28%', left: '15%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '32%', right: '30%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '38%', left: '55%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '42%', right: '5%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '48%', left: '25%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '52%', right: '45%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '58%', left: '70%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '62%', right: '20%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '68%', left: '35%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '72%', right: '60%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '78%', left: '85%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '82%', right: '35%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '85%', left: '50%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.star, { top: '88%', right: '75%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.star, { top: '5%', left: '30%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.star, { top: '65%', right: '85%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.smallStar, { top: '7%', left: '25%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.smallStar, { top: '14%', right: '22%', opacity: starOpacity2 }]} />
        <Animated.View style={[styles.smallStar, { top: '26%', left: '65%', opacity: starOpacity3 }]} />
        <Animated.View style={[styles.smallStar, { top: '34%', right: '12%', opacity: starOpacity4 }]} />
        <Animated.View style={[styles.smallStar, { top: '44%', left: '8%', opacity: starOpacity5 }]} />
        <Animated.View style={[styles.smallStar, { top: '56%', right: '28%', opacity: starOpacity6 }]} />
        <Animated.View style={[styles.smallStar, { top: '64%', left: '18%', opacity: starOpacity1 }]} />
        <Animated.View style={[styles.smallStar, { top: '76%', right: '52%', opacity: starOpacity2 }]} />
        <Animated.View style={[styles.smallStar, { top: '84%', left: '78%', opacity: starOpacity3 }]} />
        <Animated.View style={[styles.smallStar, { top: '92%', right: '42%', opacity: starOpacity4 }]} />
      </View>

      {/* Cool blue light source */}
      <LinearGradient
        colors={[
          'rgba(135, 206, 250, 0.35)',
          'rgba(100, 149, 237, 0.28)',
          'rgba(70, 130, 180, 0.22)',
          'rgba(65, 105, 225, 0.17)',
          'rgba(72, 61, 139, 0.13)',
          'rgba(75, 0, 130, 0.10)',
          'rgba(138, 43, 226, 0.075)',
          'rgba(147, 0, 211, 0.05)',
          'rgba(139, 69, 19, 0.035)',
          'rgba(25, 25, 112, 0.022)',
          'rgba(0, 0, 139, 0.015)',
          'rgba(0, 0, 128, 0.008)',
          'rgba(0, 0, 0, 0.003)',
          'rgba(0, 0, 0, 0)',
        ]}
        locations={[0, 0.06, 0.12, 0.19, 0.27, 0.36, 0.46, 0.57, 0.68, 0.78, 0.86, 0.92, 0.97, 1]}
        style={[styles.coolLight, { zIndex: 2 }]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      />

      <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ scale: cardScale }], zIndex: 10 }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? insets.top + scale(48) : scale(20)}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent' }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.centerContent, { zIndex: 20 }]}>
              <Image
                source={require('../assets/planet-512.png')} // Replace with your PNG image path
                style={[styles.image, { width: imageSize, height: imageSize, marginBottom: scale(40) }]}
                resizeMode="contain"
              />
              <View style={[styles.header, { marginBottom: scale(40) }]}>
                <Text style={[styles.title, { fontSize: scale(29) }]}>
                  Create Account
                </Text>
                <Text style={[styles.subtitle, { fontSize: scale(16), marginBottom: scale(38) }]}>
                  Join our secure file sharing platform
                </Text>
              </View>
              <View style={[styles.form, { gap: scale(20), padding: scale(24), borderRadius: scale(Platform.OS === 'ios' ? 16 : 8) }]}>
                {renderTextInput(
                  formData.username,
                  (val) => handleChange('username', val),
                  'Username',
                  usernameError,
                  'account',
                  false,
                  'default',
                  undefined,
                  () => emailInputRef.current?.focus(),
                  'next'
                )}
                {renderTextInput(
                  formData.email,
                  (val) => handleChange('email', val),
                  'Email Address',
                  emailError,
                  'email',
                  false,
                  'email-address',
                  emailInputRef,
                  () => passwordInputRef.current?.focus(),
                  'next'
                )}
                {renderTextInput(
                  formData.password,
                  (val) => handleChange('password', val),
                  'Password',
                  passwordError,
                  'lock',
                  !showPassword,
                  'default',
                  passwordInputRef,
                  handleSubmit,
                  'done'
                )}
                {renderSubmitButton()}
              </View>
              <View style={[styles.footer, { marginTop: scale(36), padding: scale(12), borderRadius: scale(12) }]}>
                <Text style={[styles.footerText, { fontSize: scale(17) }]}>
                  Already have an account?{' '}
                  <Text
                    style={styles.signupLink}
                    onPress={() => navigation.navigate('login')}
                  >
                    Sign In
                  </Text>
                </Text>
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
    backgroundColor: '#000000',
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 5,
  },
  smallStar: {
    position: 'absolute',
    width: 1,
    height: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 0.5,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
  },
  coolLight: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '85%',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 28,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    letterSpacing: 1.1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '500',
    color: '#D1D5DB',
  },
  form: {
    width: '100%',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputContainerIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputContainerAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputContainerError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderBottomWidth: Platform.OS === 'android' ? 2 : 1,
    borderBottomColor: '#FF3B30',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  inputIOS: {
    fontFamily: 'System',
  },
  inputAndroid: {
    fontFamily: 'Roboto',
  },
  errorText: {
    color: '#FF3B30',
    fontWeight: '400',
  },
  eyeIcon: {
    padding: 12,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonInner: {
    paddingVertical: 0,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 0.54,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerText: {
    color: '#D1D5DB',
    fontWeight: '400',
  },
  signupLink: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});