// index.tsx (FrontPage/Onboarding Screen)
// Place this component as your splash/landing Index screen in your app entrypoint.
// Assumes "@expo/vector-icons/MaterialCommunityIcons", "react-native-toast-message", "AsyncStorage", and "expo-linear-gradient" are installed.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function Index() {
  const router = useRouter();
  const [hide, setHide] = useState<boolean>(false);
  
  // Animation values for twinkling stars
  const starOpacity1 = new Animated.Value(0.3);
  const starOpacity2 = new Animated.Value(0.8);
  const starOpacity3 = new Animated.Value(0.5);
  const starOpacity4 = new Animated.Value(0.4);
  const starOpacity5 = new Animated.Value(0.7);
  const starOpacity6 = new Animated.Value(0.6);

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

  // Star twinkling animation
  useEffect(() => {
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

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
      animation4.stop();
      animation5.stop();
      animation6.stop();
    };
  }, []);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    router.replace('/login');
  };

  if (hide) return null;

  // Responsive sizing
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;
  const imageSize = width > 350 ? 105 : 75;

  return (
    <View style={styles.root}>
      {/* More stars in the background */}
      <View style={styles.starsContainer}>
        {/* Original stars */}
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
        
        {/* Additional stars for more density */}
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
        
        {/* Small scattered stars */}
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

      {/* Cool blue light source with rounded corners at meeting point */}
      <LinearGradient
        colors={[
          'rgba(135, 206, 250, 0.35)',  // Bright sky blue at bottom
          'rgba(100, 149, 237, 0.28)',  // Cornflower blue
          'rgba(70, 130, 180, 0.22)',   // Steel blue
          'rgba(65, 105, 225, 0.17)',   // Royal blue
          'rgba(72, 61, 139, 0.13)',    // Dark slate blue
          'rgba(75, 0, 130, 0.10)',     // Indigo
          'rgba(138, 43, 226, 0.075)',  // Blue violet
          'rgba(147, 0, 211, 0.05)',    // Dark violet
          'rgba(139, 69, 19, 0.035)',   // Subtle warm transition
          'rgba(25, 25, 112, 0.022)',   // Midnight blue
          'rgba(0, 0, 139, 0.015)',     // Dark blue
          'rgba(0, 0, 128, 0.008)',     // Navy
          'rgba(0, 0, 0, 0.003)',       // Almost black
          'rgba(0, 0, 0, 0)'            // Transparent at top
        ]}
        locations={[0, 0.06, 0.12, 0.19, 0.27, 0.36, 0.46, 0.57, 0.68, 0.78, 0.86, 0.92, 0.97, 1]}
        style={styles.coolLight}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      />

      <View style={styles.centerContent}>
        {/* Replace with your PNG image */}
        <Image
          source={require('../assets/planet-512.png')} // Replace with your PNG image path
          style={[styles.image, { width: imageSize, height: imageSize }]}
          resizeMode="contain"
        />
        <Text style={styles.title}>Welcome to SpaceShare</Text>
        <Text style={styles.subtitle}>Share files, safely—across the universe.</Text>
        <TouchableOpacity
          style={styles.button}
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
    backgroundColor: '#000000', // Black background
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 28,
    zIndex: 10, // Ensure content appears above light effects
  },
  image: {
    marginBottom: 40,
  },
  title: {
    fontSize: 29,
    fontWeight: 'bold',
    marginBottom: 9,
    letterSpacing: 1.1,
    textAlign: 'center',
    color: '#FFFFFF', // White text for title
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 38,
    textAlign: 'center',
    fontWeight: '500',
    color: '#D1D5DB', // Light gray for subtitle
  },
  button: {
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 210,
    marginTop: 30,
    backgroundColor: '#FFFFFF', // White button
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 7,
  },
  buttonText: {
    color: '#000000', // Black text for button
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.54,
  },
  // Cool blue light with increased length and rounded top corners
  coolLight: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '85%', // Extended height maintained
    zIndex: 2,
    borderTopLeftRadius: 100,  // Rounded corners where light meets the top
    borderTopRightRadius: 100,
  },
});
