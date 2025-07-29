// pass-share.tsx (PassShare Screen)
// Assumes required dependencies are installed.

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Dimensions,
  Animated,
  FlatList,
  Easing,
  StatusBar,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from './config';

const SIDEBAR_WIDTH = 260;

type SidebarIconName = 'key-variant' | 'account-multiple-outline' | 'folder' | 'logout';
interface SidebarTab {
  icon: SidebarIconName;
  label: string;
  route: string;
}

interface FileData {
  id: string;
  fileName: string;
  size: number;
  uploaderUsername: string;
}

const sidebarTabs: SidebarTab[] = [
  { icon: 'key-variant', label: 'PassShare', route: 'pass-share' },
  { icon: 'account-multiple-outline', label: 'Groups', route: 'groups' },
  { icon: 'folder', label: 'My Drive', route: 'drive' },
  { icon: 'logout', label: 'Logout', route: 'logout' },
];

export default function PassShare() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const { showActionSheetWithOptions } = useActionSheet();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [passkey, setPasskey] = useState('');
  const [joinPasskey, setJoinPasskey] = useState('');
  const [isInSession, setIsInSession] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});

  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pollingInterval = useRef<number | null>(null);

  useEffect(() => {
    // Load user data
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        try {
          setUser(JSON.parse(str));
        } catch {
          console.error('Failed to parse user data');
        }
      }
    });

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

    fadeIn.start();
    cardScaleAnim.start();
  }, []);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isLoading]);

  useFocusEffect(
    React.useCallback(() => {
      if (isInSession && passkey) fetchSessionFiles(passkey, true);
    }, [isInSession, passkey])
  );

  useEffect(() => {
    if (isInSession && passkey) {
      pollingInterval.current = setInterval(() => {
        fetchSessionFiles(passkey, true);
      }, 3000) as unknown as number;
      fetchSessionFiles(passkey, true);
    }
    return () => {
      if (pollingInterval.current !== null) clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    };
  }, [isInSession, passkey]);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(menuAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleSidebarNav = async (item: SidebarTab) => {
    closeSidebar();
    if (item.route === 'logout') {
      await AsyncStorage.clear();
      setTimeout(() => {
        navigation.reset?.({ index: 0, routes: [{ name: 'index' }] });
      }, 300);
    } else {
      navigation.navigate?.(item.route);
    }
  };

  const fetchSessionFiles = async (currentPasskey: string, silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await axios.get(`${config.url}/api/sessions/files/${currentPasskey}`);
      setFiles((prev) =>
        JSON.stringify(prev) !== JSON.stringify(response.data || []) ? response.data || [] : prev
      );
    } catch (error: any) {
      if (!silent)
        Toast.show({
          type: 'error',
          text1: 'Failed to fetch files',
          text2: error.response?.data?.message || error.message,
        });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const generatePasskey = async () => {
    if (!user?.username) {
      Toast.show({ type: 'error', text1: 'Please log in to create a session' });
      return;
    }
    setIsLoading(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setPasskey(result);
    try {
      await axios.post(`${config.url}/api/sessions/create`, {
        passkey: result,
        username: user.username,
      });
      setIsInSession(true);
      Toast.show({ type: 'success', text1: `Session created with passkey: ${result}` });
      await fetchSessionFiles(result, true);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to create session',
        text2: error.response?.data?.message || error.message,
      });
      setPasskey('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.username) {
      Toast.show({ type: 'error', text1: 'Please log in to join a session' });
      return;
    }
    if (!joinPasskey.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter a passkey' });
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(`${config.url}/api/sessions/join`, {
        passkey: joinPasskey.trim(),
        username: user.username,
      });
      setPasskey(joinPasskey.trim());
      setIsInSession(true);
      Toast.show({ type: 'success', text1: 'Joined session!' });
      await fetchSessionFiles(joinPasskey.trim(), true);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to join session',
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setIsLoading(false);
      setJoinPasskey('');
    }
  };

  const copyPasskey = async () => {
    if (!passkey) return;
    await Clipboard.setStringAsync(passkey);
    Toast.show({ type: 'success', text1: 'Passkey copied to clipboard!' });
  };

  const handleFileUpload = async () => {
    const options = ['Pick Photo', 'Pick Document', 'Cancel'];
    const cancelButtonIndex = 2;
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Upload File',
        message: 'Choose what you want to share',
        userInterfaceStyle: 'dark',
      },
      async (buttonIndex) => {
        if (buttonIndex === 0) await _handlePhotoPick();
        if (buttonIndex === 1) await _handleDocumentPick();
      }
    );
  };

  const _handleDocumentPick = async () => {
    if (!user?.id || !passkey) {
      Toast.show({ type: 'error', text1: 'Please log in and join/create session to upload files' });
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      let fileSize: number = typeof file.size === 'number' ? file.size : 0;
      if (!fileSize && file.uri) {
        const info = await FileSystem.getInfoAsync(file.uri);
        if (info.exists && typeof info.size === 'number') fileSize = info.size;
      }
      if (fileSize > 10 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File size must be less than 10MB.' });
        return;
      }
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        name: file.name || `upload.${(file.mimeType || '').split('/')[1] || 'bin'}`,
      } as any);
      const tempId = `temp-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));
      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt: any) => {
          const percent = Math.round(100 * (evt.loaded / evt.total));
          setUploadProgress((p) => ({ ...p, [tempId]: percent }));
        },
      });
      Toast.show({ type: 'success', text1: 'File uploaded successfully' });
      await fetchSessionFiles(passkey, true);
      setTimeout(() => setUploadProgress((prev) => { const p = { ...prev }; delete p[tempId]; return p; }), 1000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to upload file',
        text2: error.response?.data?.message || error.message,
      });
    }
  };

  const _handlePhotoPick = async () => {
    if (!user?.id || !passkey) {
      Toast.show({ type: 'error', text1: 'Please log in and join/create session to upload photos' });
      return;
    }
    try {
      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (picker.canceled || !picker.assets || picker.assets.length === 0) return;
      const asset = picker.assets[0];
      let fileSize: number = typeof asset.fileSize === 'number' ? asset.fileSize : 0;
      if (!fileSize && asset.uri) {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof info.size === 'number') fileSize = info.size;
      }
      if (fileSize > 10 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'Image must be less than 10MB.' });
        return;
      }
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      } as any);
      const tempId = `temp-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));
      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt: any) => {
          const percent = Math.round(100 * (evt.loaded / evt.total));
          setUploadProgress((p) => ({ ...p, [tempId]: percent }));
        },
      });
      Toast.show({ type: 'success', text1: 'Photo uploaded successfully' });
      await fetchSessionFiles(passkey, true);
      setTimeout(() => setUploadProgress((prev) => { const p = { ...prev }; delete p[tempId]; return p; }), 1000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to upload photo',
        text2: error.response?.data?.message || error.message,
      });
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      setDownloadProgress((prev) => ({ ...prev, [fileId]: 0 }));
      Toast.show({ type: 'info', text1: 'Download started...' });
      const downloadUrlResp = await axios.get(`${config.url}/api/sessions/download/${fileId}`, {
        responseType: 'json',
      });
      const url = downloadUrlResp.data?.url ?? `${config.url}/api/sessions/download/${fileId}`;
      const localUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${fileName}`;
      const downloadObj = FileSystem.createDownloadResumable(url, localUri, {}, (progress) => {
        const percent = Math.floor(
          100 * (progress.totalBytesWritten / (progress.totalBytesExpectedToWrite ?? 1))
        );
        setDownloadProgress((prev) => ({ ...prev, [fileId]: percent }));
      });
      const ret = await downloadObj.downloadAsync();
      if (ret?.uri) {
        await Sharing.shareAsync(ret.uri, {
          mimeType: undefined,
          dialogTitle: 'Save or share file',
          UTI: undefined,
        });
        Toast.show({ type: 'success', text1: 'Download complete!' });
      } else {
        throw new Error('Failed.');
      }
      setTimeout(() => setDownloadProgress((prev) => { const n = { ...prev }; delete n[fileId]; return n; }), 800);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to download',
        text2: error.response?.data?.message || error.message,
      });
    }
  };

  const renderSidebar = () => {
    const sidebarStyles = [
      styles.sidebar,
      Platform.select({
        ios: styles.sidebarIOS,
        android: styles.sidebarAndroid,
      }),
    ];

    return (
      <Animated.View style={[sidebarStyles, { left: sidebarAnim }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" />
        <View style={[styles.sidebarHeader, { paddingTop: insets.top + scale(20) }]}>
          <Image
            source={require('../assets/planet-512.png')}
            style={[styles.sidebarLogo, { width: scale(50), height: scale(50) }]}
            resizeMode="contain"
          />
          <Text style={[styles.sidebarTitle, { fontSize: scale(24) }]}>PassShare</Text>
          {user && (
            <Text style={[styles.sidebarSubtitle, { fontSize: scale(14) }]}>
              {user.username}
            </Text>
          )}
        </View>
        <FlatList
          data={sidebarTabs}
          keyExtractor={(item) => item.route}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sidebarTab, Platform.OS === 'android' && item.route === 'pass-share' && styles.sidebarTabActiveAndroid]}
              activeOpacity={0.7}
              onPress={() => handleSidebarNav(item)}
              accessibilityLabel={item.label}
              accessibilityHint={`Navigate to ${item.label}`}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={scale(24)}
                color="#FFFFFF"
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarTabText, { fontSize: scale(16) }]}>{item.label}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.sidebarTabContainer}
        />
      </Animated.View>
    );
  };

  const renderTextInput = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    iconName: string,
    editable: boolean = true,
    onSubmitEditing?: () => void
  ) => {
    const containerStyles = [
      styles.inputContainer,
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
      <View style={containerStyles}>
        <MaterialCommunityIcons
          name={iconName as any}
          size={scale(20)}
          color="#FFFFFF"
          style={styles.inputIcon}
        />
        <TextInput
          style={inputStyles}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A0A0A0"
          editable={editable}
          autoCapitalize="characters"
          returnKeyType="go"
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={placeholder}
          accessibilityHint={`Enter ${placeholder.toLowerCase()}`}
        />
        {value && placeholder === 'Generated passkey' && (
          <TouchableOpacity
            onPress={copyPasskey}
            style={styles.copyIcon}
            activeOpacity={0.7}
            accessibilityLabel="Copy passkey"
            accessibilityHint="Copy the generated passkey to clipboard"
          >
            <MaterialCommunityIcons name="content-copy" size={scale(20)} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const { width } = Dimensions.get('window');
  const scale = (size: number) => Math.min(width / 414, 1) * size;
  const imageSize = scale(105);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '359deg'] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
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
      {sidebarOpen && (
        <TouchableOpacity
          style={[styles.sidebarOverlay, { zIndex: 99 }]}
          onPress={closeSidebar}
          activeOpacity={1}
          accessibilityLabel="Close sidebar"
          accessibilityHint="Tap to close the navigation menu"
        />
      )}
      {renderSidebar()}
      <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ scale: cardScale }], zIndex: 10 }]}>
        <View style={[styles.header, { paddingTop: insets.top + scale(10) }, Platform.select({ ios: styles.headerIOS, android: styles.headerAndroid })]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={sidebarOpen ? closeSidebar : openSidebar}
            activeOpacity={0.7}
            accessibilityLabel="Toggle sidebar"
            accessibilityHint="Tap to open or close the navigation menu"
          >
            {isIOS ? (
              <MaterialCommunityIcons name={sidebarOpen ? 'close' : 'menu'} size={scale(24)} color="#FFFFFF" />
            ) : (
              <>
                <Animated.View
                  style={[
                    styles.menuBar,
                    {
                      transform: [{ rotate: menuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }, { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                />
                <Animated.View style={[styles.menuBar, { opacity: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }, { backgroundColor: '#FFFFFF' }]} />
                <Animated.View
                  style={[
                    styles.menuBar,
                    {
                      transform: [{ rotate: menuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] }) }, { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                />
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: scale(22) }]}>PassShare</Text>
          <View style={{ width: scale(44) }} />
        </View>
        {!user ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize, marginBottom: scale(40) }]}
              resizeMode="contain"
            />
            <View style={[styles.card, Platform.select({ ios: styles.cardIOS, android: styles.cardAndroid })]}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={scale(58)}
                color="#FFFFFF"
                style={{ marginBottom: scale(20) }}
              />
              <Text style={[styles.cardTitle, { fontSize: scale(20) }]}>You must sign in first</Text>
              <TouchableOpacity
                style={[styles.button, Platform.select({ ios: styles.buttonIOS, android: styles.buttonAndroid })]}
                onPress={() => navigation.navigate('login')}
                activeOpacity={0.7}
                accessibilityLabel="Go to login"
                accessibilityHint="Tap to navigate to the login screen"
              >
                <Text style={[styles.buttonText, { fontSize: scale(16) }]}>Go to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isLoading ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize, marginBottom: scale(40) }]}
              resizeMode="contain"
            />
            <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: scale(22) }}>
              <MaterialCommunityIcons name="upload" size={scale(64)} color="#FFFFFF" />
            </Animated.View>
            <Text style={[styles.loadingText, { fontSize: scale(18) }]}>Connecting to secure channel...</Text>
          </View>
        ) : !isInSession ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize, marginBottom: scale(40) }]}
              resizeMode="contain"
            />
            <View style={[styles.card, Platform.select({ ios: styles.cardIOS, android: styles.cardAndroid })]}>
              <Text style={[styles.cardTitle, { fontSize: scale(24) }]}>Secure File Sharing</Text>
              <Text style={[styles.cardSubtitle, { fontSize: scale(15) }]}>
                Share files securely with a generated passkey
              </Text>
              <View style={[styles.sessionContainer, { gap: scale(20) }]}>
                <View style={styles.sessionCard}>
                  <Text style={[styles.sessionCardTitle, { fontSize: scale(19) }]}>Create Share</Text>
                  {renderTextInput(
                    passkey,
                    () => {},
                    'Generated passkey',
                    'key-variant',
                    false
                  )}
                  <TouchableOpacity
                    style={[styles.button, Platform.select({ ios: styles.buttonIOS, android: styles.buttonAndroid })]}
                    onPress={generatePasskey}
                    disabled={isLoading}
                    activeOpacity={0.7}
                    accessibilityLabel="Generate passkey"
                    accessibilityHint="Tap to create a new session passkey"
                  >
                    <Text style={[styles.buttonText, { fontSize: scale(16) }]}>Generate Passkey</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sessionCard}>
                  <Text style={[styles.sessionCardTitle, { fontSize: scale(19) }]}>Join Share</Text>
                  {renderTextInput(
                    joinPasskey,
                    setJoinPasskey,
                    'Enter passkey',
                    'key-variant',
                    true,
                    handleJoin
                  )}
                  <TouchableOpacity
                    style={[styles.button, Platform.select({ ios: styles.buttonIOS, android: styles.buttonAndroid })]}
                    onPress={handleJoin}
                    disabled={isLoading}
                    activeOpacity={0.7}
                    accessibilityLabel="Join session"
                    accessibilityHint="Tap to join a session with the entered passkey"
                  >
                    <Text style={[styles.buttonText, { fontSize: scale(16) }]}>Join Session</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.sessionContent, { paddingBottom: insets.bottom + scale(20) }]}>
            <View style={[styles.headerSection, { marginBottom: scale(20) }]}>
              <Image
                source={require('../assets/planet-512.png')}
                style={[styles.image, { width: imageSize * 0.8, height: imageSize * 0.8, marginBottom: scale(20) }]}
                resizeMode="contain"
              />
              <Text style={[styles.modalTitle, { fontSize: scale(24) }]}>Secure File Sharing Session</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(6) }}>
                <Text style={[styles.passkeyLabel, { fontSize: scale(15) }]}>
                  Passkey: <Text style={[styles.passkeyText, { fontSize: scale(15) }]}>{passkey}</Text>
                </Text>
                <TouchableOpacity
                  onPress={copyPasskey}
                  style={[styles.copyIcon, { marginLeft: scale(10) }]}
                  activeOpacity={0.7}
                  accessibilityLabel="Copy passkey"
                  accessibilityHint="Copy the session passkey to clipboard"
                >
                  <MaterialCommunityIcons name="content-copy" size={scale(20)} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.uploadArea, Platform.select({ ios: styles.uploadAreaIOS, android: styles.uploadAreaAndroid })]}>
              <TouchableOpacity
                style={[styles.uploadButtonArea, { zIndex: 20 }]}
                onPress={handleFileUpload}
                activeOpacity={0.7}
                accessibilityLabel="Upload file"
                accessibilityHint="Tap to upload a photo or document"
              >
                <MaterialCommunityIcons name="upload" size={scale(35)} color="#FFFFFF" style={{ marginBottom: scale(5) }} />
                <Text style={[styles.uploadButtonText, { fontSize: scale(16) }]}>Upload</Text>
              </TouchableOpacity>
              <Text style={[styles.uploadHint, { fontSize: scale(13) }]}>
                Upload a document or photo under 10MB
              </Text>
            </View>
            <View style={[styles.filesCard, Platform.select({ ios: styles.filesCardIOS, android: styles.filesCardAndroid })]}>
              <Text style={[styles.filesCardTitle, { fontSize: scale(18) }]}>Shared Files</Text>
              {!files || files.length === 0 ? (
                <Text style={[styles.noFilesText, { fontSize: scale(15) }]}>No files shared yet.</Text>
              ) : (
                <FlatList
                  style={{ width: '100%' }}
                  data={files}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.fileRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialCommunityIcons
                          name="file-upload-outline"
                          size={scale(26)}
                          color="#FFFFFF"
                          style={{ marginRight: scale(10) }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fileName, { fontSize: scale(15) }]} numberOfLines={1}>
                            {item.fileName}
                          </Text>
                          <Text style={[styles.fileInfo, { fontSize: scale(13) }]}>
                            Uploaded by {item.uploaderUsername} • {(item.size / 1024).toFixed(2)} KB
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: scale(70) }}>
                        {(uploadProgress[item.id] > 0 || downloadProgress[item.id] > 0) && (
                          <View style={[styles.progressBar, { width: scale(44), marginRight: scale(7) }]}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${uploadProgress[item.id] ?? downloadProgress[item.id] ?? 0}%` },
                              ]}
                            />
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.downloadButton}
                          onPress={() => handleDownload(item.id, item.fileName)}
                          activeOpacity={0.7}
                          accessibilityLabel={`Download ${item.fileName}`}
                          accessibilityHint="Tap to download this file"
                        >
                          <MaterialCommunityIcons name="download" size={scale(23)} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  ListFooterComponent={<View style={{ height: scale(10) }} />}
                  contentContainerStyle={files.length === 0 ? {} : { paddingBottom: scale(10) }}
                />
              )}
            </View>
          </View>
        )}
      </Animated.View>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  rootCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    zIndex: 100,
    paddingHorizontal: 20,
  },
  sidebarIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 2, height: 0 },
    borderRightWidth: 0,
  },
  sidebarAndroid: {
    backgroundColor: '#212121',
    elevation: 8,
    borderRightWidth: 1,
    borderRightColor: '#424242',
  },
  sidebarHeader: {
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  sidebarLogo: {
    marginBottom: 10,
  },
  sidebarTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sidebarSubtitle: {
    color: '#D1D5DB',
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sidebarTabContainer: {
    paddingBottom: 20,
  },
  sidebarTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sidebarTabActiveAndroid: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  sidebarIcon: {
    marginRight: 12,
  },
  sidebarTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headerAndroid: {
    backgroundColor: '#212121',
    elevation: 4,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  menuBar: {
    width: 29,
    height: 3.6,
    borderRadius: 3,
    marginVertical: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.11,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  card: {
    width: '90%',
    padding: 24,
    borderRadius: Platform.OS === 'ios' ? 16 : 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  cardIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  cardAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 4,
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  cardSubtitle: {
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sessionContainer: {
    flexDirection: 'column',
    width: '100%',
    gap: 20,
  },
  sessionCard: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    marginVertical: 10,
  },
  sessionCardTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputContainerIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputContainerAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 2,
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
  copyIcon: {
    padding: 12,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    marginTop: 10,
  },
  buttonIOS: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonAndroid: {
    backgroundColor: '#FFFFFF',
    elevation: 4,
  },
  buttonText: {
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 0.54,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  image: {
    alignSelf: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sessionContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  headerSection: {
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  passkeyLabel: {
    color: '#D1D5DB',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  passkeyText: {
    fontFamily: 'Courier',
    color: '#FFFFFF',
    fontWeight: '700',
  },
  uploadArea: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: Platform.OS === 'ios' ? 16 : 8,
    marginVertical: 12,
    width: '94%',
    zIndex: 20,
  },
  uploadAreaIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  uploadAreaAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 4,
  },
  uploadButtonArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    zIndex: 20,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  uploadHint: {
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  filesCard: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: Platform.OS === 'ios' ? 16 : 8,
    width: '94%',
    marginTop: 18,
    marginBottom: 6,
  },
  filesCardIOS: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  filesCardAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 4,
  },
  filesCardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 9,
    letterSpacing: 0.1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  noFilesText: {
    color: '#D1D5DB',
    textAlign: 'center',
    paddingVertical: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 8,
  },
  fileName: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  fileInfo: {
    color: '#D1D5DB',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#26293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  downloadButton: {
    padding: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});