import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from './config';

const SIDEBAR_WIDTH = 280;

type SidebarIconName = 'key-variant' | 'logout';
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
  const [isUploading, setIsUploading] = useState(false);

  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pollingInterval = useRef<number | null>(null);

  const { width } = Dimensions.get('window');
  const scale = (size: number) => Math.min(width / 414, 1) * size;
  const imageSize = scale(100);

  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        try {
          setUser(JSON.parse(str));
        } catch {
          console.error('Failed to parse user data');
        }
      }
    });

    (async () => {
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (mediaStatus.status !== 'granted' || cameraStatus.status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Please allow access to photos and camera.',
        });
      }
    })();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isLoading]);

  useFocusEffect(
    useCallback(() => {
      if (isInSession && passkey) fetchSessionFiles(passkey, true);
    }, [isInSession, passkey])
  );

  useEffect(() => {
    if (isInSession && passkey) {
      pollingInterval.current = setInterval(() => fetchSessionFiles(passkey, true), 5000) as unknown as number;
      fetchSessionFiles(passkey, true);
    }
    return () => {
      if (pollingInterval.current !== null) clearInterval(pollingInterval.current);
    };
  }, [isInSession, passkey]);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.spring(sidebarAnim, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: -SIDEBAR_WIDTH,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => setSidebarOpen(false));
  };

  const handleSidebarNav = async (item: SidebarTab) => {
    animateButton();
    closeSidebar();
    if (item.route === 'logout') {
      try {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'index' }] });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Logout Failed', text2: 'Please try again.' });
      }
    } else {
      navigation.navigate(item.route);
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
          text1: 'Failed to Fetch Files',
          text2: error.response?.data?.message || 'Network error.',
        });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const generatePasskey = async () => {
    if (!user?.username) {
      Toast.show({ type: 'error', text1: 'Please log in to create a session.' });
      return;
    }
    animateButton();
    setIsLoading(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const result = Array(8).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    setPasskey(result);
    try {
      await axios.post(`${config.url}/api/sessions/create`, {
        passkey: result,
        username: user.username,
      });
      setIsInSession(true);
      Toast.show({ type: 'success', text1: `Session Created: ${result}` });
      await fetchSessionFiles(result, true);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Session Creation Failed',
        text2: error.response?.data?.message || 'Network error.',
      });
      setPasskey('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.username) {
      Toast.show({ type: 'error', text1: 'Please log in to join a session.' });
      return;
    }
    if (!joinPasskey.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a valid passkey.' });
      return;
    }
    animateButton();
    setIsLoading(true);
    try {
      await axios.post(`${config.url}/api/sessions/join`, {
        passkey: joinPasskey.trim(),
        username: user.username,
      });
      setPasskey(joinPasskey.trim());
      setIsInSession(true);
      Toast.show({ type: 'success', text1: 'Joined Session!' });
      await fetchSessionFiles(joinPasskey.trim(), true);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Join Session',
        text2: error.response?.data?.message || 'Invalid passkey.',
      });
    } finally {
      setIsLoading(false);
      setJoinPasskey('');
    }
  };

  const handleExitSession = () => {
    animateButton();
    setIsInSession(false);
    setPasskey('');
    setFiles([]);
    Toast.show({ type: 'success', text1: 'Left Session' });
  };

  const copyPasskey = async () => {
    if (!passkey) return;
    animateButton();
    await Clipboard.setStringAsync(passkey);
    Toast.show({ type: 'success', text1: 'Passkey Copied!' });
  };

  const uploadFile = async (fileUri: string, fileName: string, mimeType: string, fileSize?: number) => {
    try {
      if (!user?.id || !passkey) {
        Toast.show({ type: 'error', text1: 'Please log in and join a session.' });
        return;
      }

      // Check file size
      let actualSize = fileSize;
      if (!actualSize) {
        const info = await FileSystem.getInfoAsync(fileUri);
        actualSize = info.exists && typeof info.size === 'number' ? info.size : 0;
      }

      if (actualSize > 10 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File too large (max 10MB).' });
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);

      const tempId = `temp-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

      Toast.show({ type: 'info', text1: 'Uploading...', text2: fileName });

      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const percent = Math.round(100 * (evt.loaded / (evt.total ?? 1)));
          setUploadProgress((p) => ({ ...p, [tempId]: percent }));
        },
      });

      Toast.show({ type: 'success', text1: 'File Uploaded!', text2: fileName });
      await fetchSessionFiles(passkey, true);
      
      setTimeout(() => {
        setUploadProgress((prev) => {
          const p = { ...prev };
          delete p[tempId];
          return p;
        });
      }, 1000);
    } catch (error: any) {
      console.error('Upload error:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.response?.data?.message || 'Network error.',
      });
    }
  };

  const handleFileUpload = useCallback(async () => {
    if (isUploading) {
      Toast.show({ type: 'info', text1: 'Upload in Progress', text2: 'Please wait.' });
      return;
    }

    if (!user?.id || !passkey) {
      Toast.show({ type: 'error', text1: 'Please log in and join a session.' });
      return;
    }

    animateButton();

    const options = ['Take Photo', 'Choose Photo', 'Choose Document', 'Cancel'];
    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Upload File',
        message: 'Choose a file type to upload',
        userInterfaceStyle: 'dark',
        tintColor: '#E6E6FA',
        containerStyle: styles.actionSheet,
      },
      async (buttonIndex) => {
        if (buttonIndex === undefined || buttonIndex === cancelButtonIndex) {
          return;
        }

        setIsUploading(true);

        try {
          if (buttonIndex === 0) {
            // Take Photo
            await _handleTakePhoto();
          } else if (buttonIndex === 1) {
            // Choose Photo
            await _handleChoosePhoto();
          } else if (buttonIndex === 2) {
            // Choose Document
            await _handleDocumentPick();
          }
        } catch (error: any) {
          console.error('File picker error:', error);
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: error.message || 'Unknown error.',
          });
        } finally {
          setIsUploading(false);
        }
      }
    );
  }, [isUploading, user, passkey, showActionSheetWithOptions]);

  const _handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      
      await uploadFile(asset.uri, fileName, mimeType, asset.fileSize);
    } catch (error: any) {
      console.error('Camera error:', error);
      throw new Error('Failed to take photo');
    }
  };

  const _handleChoosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      
      await uploadFile(asset.uri, fileName, mimeType, asset.fileSize);
    } catch (error: any) {
      console.error('Image picker error:', error);
      throw new Error('Failed to choose photo');
    }
  };

  const _handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name || `document_${Date.now()}`;
      const mimeType = asset.mimeType || 'application/octet-stream';
      
      await uploadFile(asset.uri, fileName, mimeType, asset.size);
    } catch (error: any) {
      console.error('Document picker error:', error);
      throw new Error('Failed to choose document');
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    animateButton();
    try {
      setDownloadProgress((prev) => ({ ...prev, [fileId]: 0 }));
      Toast.show({ type: 'info', text1: 'Downloading...' });
      
      const downloadUrlResp = await axios.get(`${config.url}/api/sessions/download/${fileId}`, {
        responseType: 'json',
      });
      
      const url = downloadUrlResp.data?.url ?? `${config.url}/api/sessions/download/${fileId}`;
      const localUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${fileName}`;
      
      const downloadObj = FileSystem.createDownloadResumable(url, localUri, {}, (progress) => {
        const percent = Math.floor(
          100 * (progress.totalBytesWritten / (progress.totalBytesExpectedToWrite || 1))
        );
        setDownloadProgress((prev) => ({ ...prev, [fileId]: percent }));
      });
      
      const ret = await downloadObj.downloadAsync();
      
      if (ret?.uri) {
        await Sharing.shareAsync(ret.uri, { dialogTitle: 'Save or Share File' });
        Toast.show({ type: 'success', text1: 'Download Complete!' });
      } else {
        throw new Error('Download failed');
      }
      
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const n = { ...prev };
          delete n[fileId];
          return n;
        });
      }, 800);
    } catch (error: any) {
      console.error('Download error:', error);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: error.response?.data?.message || 'Network error.',
      });
    }
  };

  const renderSidebar = () => (
    <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1C2526" translucent />
      <View style={[styles.sidebarHeader, { paddingTop: insets.top + scale(16) }]}>
        <Image
          source={require('../assets/planet-512.png')}
          style={[styles.sidebarLogo, { width: scale(50), height: scale(50) }]}
          resizeMode="contain"
        />
        <Text style={[styles.sidebarTitle, { fontSize: scale(24) }]}>PassShare</Text>
        {user && <Text style={[styles.sidebarSubtitle, { fontSize: scale(16) }]}>{user.username}</Text>}
      </View>
      <FlatList
        data={sidebarTabs}
        keyExtractor={(item) => item.route}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.sidebarTab, item.route === 'pass-share' && styles.sidebarTabActive]}
            activeOpacity={0.7}
            onPress={() => handleSidebarNav(item)}
            accessibilityLabel={item.label}
          >
            <MaterialCommunityIcons name={item.icon} size={scale(24)} color="#E6E6FA" style={styles.sidebarIcon} />
            <Text style={[styles.sidebarTabText, { fontSize: scale(18) }]}>{item.label}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.sidebarTabContainer}
      />
    </Animated.View>
  );

  const renderTextInput = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    iconName: string,
    editable: boolean = true,
    onSubmitEditing?: () => void
  ) => (
    <View style={styles.inputContainer}>
      <View style={styles.inputWrapper}>
        <MaterialCommunityIcons name={iconName as any} size={scale(20)} color="#E6E6FA" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B0B0C0"
          editable={editable}
          autoCapitalize="characters"
          returnKeyType="go"
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={placeholder}
        />
        {value && placeholder === 'Generated Passkey' && (
          <TouchableOpacity onPress={copyPasskey} style={styles.copyIcon} accessibilityLabel="Copy Passkey">
            <MaterialCommunityIcons name="content-copy" size={scale(20)} color="#E6E6FA" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1C2526" translucent />
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.sidebarOverlay}
          onPress={closeSidebar}
          activeOpacity={1}
          accessibilityLabel="Close Sidebar"
        />
      )}
      {renderSidebar()}
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
        <View style={[styles.header, { paddingTop: insets.top + scale(12) }]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              animateButton();
              sidebarOpen ? closeSidebar() : openSidebar();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Sidebar"
          >
            <MaterialCommunityIcons name={sidebarOpen ? 'close' : 'menu'} size={scale(28)} color="#E6E6FA" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: scale(24) }]}>PassShare</Text>
          <View style={{ width: scale(28) }} />
        </View>
        
        {!user ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize }]}
              resizeMode="contain"
            />
            <View style={styles.card}>
              <MaterialCommunityIcons name="alert-circle-outline" size={scale(60)} color="#E6E6FA" style={styles.cardIcon} />
              <Text style={[styles.cardTitle, { fontSize: scale(22) }]}>Sign In Required</Text>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() => {
                    animateButton();
                    navigation.navigate('login');
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Go to Login"
                >
                  <Text style={[styles.buttonText, { fontSize: scale(18) }]}>Sign In</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        ) : isLoading ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize }]}
              resizeMode="contain"
            />
            <Animated.View style={{ transform: [{ rotate: spin }], marginVertical: scale(20) }}>
              <MaterialCommunityIcons name="loading" size={scale(50)} color="#E6E6FA" />
            </Animated.View>
            <Text style={[styles.loadingText, { fontSize: scale(18) }]}>Connecting...</Text>
          </View>
        ) : !isInSession ? (
          <View style={styles.rootCenter}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize, height: imageSize }]}
              resizeMode="contain"
            />
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { fontSize: scale(24) }]}>Secure File Sharing</Text>
              <Text style={[styles.cardSubtitle, { fontSize: scale(16) }]}>Share files with a secure passkey</Text>
              <View style={styles.sessionContainer}>
                <View style={styles.sessionCard}>
                  <Text style={[styles.sessionCardTitle, { fontSize: scale(20) }]}>Create Session</Text>
                  {renderTextInput(passkey, () => {}, 'Generated Passkey', 'key-variant', false)}
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonPrimary, isLoading && styles.buttonDisabled]}
                      onPress={generatePasskey}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      accessibilityLabel="Generate Passkey"
                    >
                      <Text style={[styles.buttonText, { fontSize: scale(18) }]}>Generate Passkey</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
                <View style={styles.sessionCard}>
                  <Text style={[styles.sessionCardTitle, { fontSize: scale(20) }]}>Join Session</Text>
                  {renderTextInput(joinPasskey, setJoinPasskey, 'Enter Passkey', 'key-variant', true, handleJoin)}
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonPrimary, isLoading && styles.buttonDisabled]}
                      onPress={handleJoin}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      accessibilityLabel="Join Session"
                    >
                      <Text style={[styles.buttonText, { fontSize: scale(18) }]}>Join Session</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.sessionContent, { paddingBottom: insets.bottom + scale(20) }]}>
            <Image
              source={require('../assets/planet-512.png')}
              style={[styles.image, { width: imageSize * 0.8, height: imageSize * 0.8 }]}
              resizeMode="contain"
            />
            <Text style={[styles.modalTitle, { fontSize: scale(24) }]}>Secure Sharing Session</Text>
            <View style={styles.passkeyRow}>
              <Text style={[styles.passkeyLabel, { fontSize: scale(16) }]}>Passkey: {passkey}</Text>
              <TouchableOpacity onPress={copyPasskey} accessibilityLabel="Copy Passkey">
                <MaterialCommunityIcons name="content-copy" size={scale(20)} color="#E6E6FA" />
              </TouchableOpacity>
            </View>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleExitSession}
                activeOpacity={0.7}
                accessibilityLabel="Exit Session"
              >
                <Text style={[styles.buttonText, { fontSize: scale(18) }]}>Exit Session</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.uploadArea}>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.uploadButton, isUploading && styles.buttonDisabled]}
                  onPress={handleFileUpload}
                  disabled={isUploading}
                  activeOpacity={0.7}
                  accessibilityLabel="Upload File"
                >
                  <MaterialCommunityIcons
                    name="upload"
                    size={scale(28)}
                    color={isUploading ? '#B0B0C0' : '#E6E6FA'}
                  />
                  <Text
                    style={[styles.uploadButtonText, { fontSize: scale(18), color: isUploading ? '#B0B0C0' : '#E6E6FA' }]}
                  >
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={[styles.uploadHint, { fontSize: scale(14) }]}>Max 10MB (Photo or Document)</Text>
            </View>
            <View style={styles.filesCard}>
              <Text style={[styles.filesCardTitle, { fontSize: scale(20) }]}>Shared Files</Text>
              {files.length === 0 ? (
                <Text style={[styles.noFilesText, { fontSize: scale(16) }]}>No files shared yet.</Text>
              ) : (
                <FlatList
                  style={styles.fileList}
                  data={files}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.fileRow}>
                      <MaterialCommunityIcons name="file-outline" size={scale(28)} color="#E6E6FA" style={styles.fileIcon} />
                      <View style={styles.fileInfo}>
                        <Text style={[styles.fileName, { fontSize: scale(16) }]} numberOfLines={1}>
                          {item.fileName}
                        </Text>
                        <Text style={[styles.fileMeta, { fontSize: scale(14) }]}>
                          {item.uploaderUsername} • {(item.size / 1024).toFixed(2)} KB
                        </Text>
                      </View>
                      {(uploadProgress[item.id] || downloadProgress[item.id]) ? (
                        <View style={[styles.progressBar, { width: scale(80) }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${uploadProgress[item.id] || downloadProgress[item.id] || 0}%` },
                            ]}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.downloadButton}
                          onPress={() => handleDownload(item.id, item.fileName)}
                          activeOpacity={0.7}
                          accessibilityLabel={`Download ${item.fileName}`}
                        >
                          <MaterialCommunityIcons name="download" size={scale(24)} color="#E6E6FA" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
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
    backgroundColor: '#1C2526',
  },
  rootCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#1C2526',
    zIndex: 100,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  sidebarHeader: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sidebarLogo: {
    marginBottom: 12,
  },
  sidebarTitle: {
    fontWeight: '800',
    color: '#E6E6FA',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  sidebarSubtitle: {
    fontWeight: '500',
    color: '#B0B0C0',
  },
  sidebarTabContainer: {
    paddingVertical: 12,
  },
  sidebarTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginVertical: 6,
  },
  sidebarTabActive: {
    backgroundColor: '#6B5B95',
  },
  sidebarIcon: {
    marginRight: 14,
  },
  sidebarTabText: {
    fontWeight: '700',
    color: '#E6E6FA',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 99,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1C2526',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuButton: {
    padding: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: '#E6E6FA',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 450,
    padding: 24,
    backgroundColor: '#2F3E46',
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  cardIcon: {
    marginBottom: 20,
  },
  cardTitle: {
    fontWeight: '800',
    color: '#E6E6FA',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  cardSubtitle: {
    fontWeight: '500',
    color: '#B0B0C0',
    textAlign: 'center',
    marginBottom: 20,
  },
  sessionContainer: {
    width: '100%',
    gap: 20,
  },
  sessionCard: {
    padding: 20,
    backgroundColor: '#354F52',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  sessionCardTitle: {
    fontWeight: '800',
    color: '#E6E6FA',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    height: 52,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F3E46',
    borderRadius: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#E6E6FA',
    fontWeight: '500',
  },
  copyIcon: {
    padding: 10,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#6B5B95',
    paddingVertical: 14,
  },
  buttonDanger: {
    backgroundColor: '#FF4040',
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: '#444444',
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '700',
    color: '#E6E6FA',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  image: {
    marginVertical: 20,
  },
  loadingText: {
    fontWeight: '600',
    color: '#E6E6FA',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'Roboto-Medium',
  },
  sessionContent: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalTitle: {
    fontWeight: '800',
    color: '#E6E6FA',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  passkeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passkeyLabel: {
    fontWeight: '700',
    color: '#E6E6FA',
    marginRight: 10,
  },
  uploadArea: {
    width: '100%',
    maxWidth: 450,
    padding: 20,
    backgroundColor: '#354F52',
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B5B95',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  uploadButtonText: {
    fontWeight: '700',
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  uploadHint: {
    fontWeight: '500',
    color: '#B0B0C0',
    marginTop: 10,
  },
  filesCard: {
    width: '100%',
    maxWidth: 450,
    padding: 20,
    backgroundColor: '#2F3E46',
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  filesCardTitle: {
    fontWeight: '800',
    color: '#E6E6FA',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  noFilesText: {
    fontWeight: '500',
    color: '#B0B0C0',
    textAlign: 'center',
    paddingVertical: 20,
  },
  fileList: {
    width: '100%',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3A4B4F',
    borderRadius: 8,
    marginVertical: 4,
  },
  fileIcon: {
    marginRight: 14,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontWeight: '700',
    color: '#E6E6FA',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Roboto-Bold',
  },
  fileMeta: {
    fontWeight: '500',
    color: '#B0B0C0',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B5B95',
    borderRadius: 4,
  },
  downloadButton: {
    padding: 10,
    backgroundColor: '#6B5B95',
    borderRadius: 8,
  },
  actionSheet: {
    backgroundColor: '#2F3E46',
    borderRadius: 12,
  },
});
