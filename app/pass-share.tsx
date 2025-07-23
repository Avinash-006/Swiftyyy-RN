import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Platform, useColorScheme,
  Dimensions, Animated, FlatList, Easing, StatusBar
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
import config from './config';

// Allowed sidebar icons
type SidebarIconName = 'key-variant' | 'account-multiple-outline' | 'folder' | 'logout';
interface SidebarTab { icon: SidebarIconName; label: string; route: string; }

const SIDEBAR_WIDTH = 220;
const sidebarTabs: SidebarTab[] = [
  { icon: 'key-variant', label: 'PassShare', route: 'pass-share' },
  { icon: 'account-multiple-outline', label: 'Groups', route: 'groups' },
  { icon: 'folder', label: 'My Drive', route: 'drive' },
  { icon: 'logout', label: 'Logout', route: 'logout' },
];

interface FileData {
  id: string;
  fileName: string;
  size: number;
  uploaderUsername: string;
}

export default function PassShare() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showActionSheetWithOptions } = useActionSheet();
  const navigation = useNavigation();

  // Sidebar animation state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;

  // Hamburger menu bar animations (fixed inputRange)
  const bar1 = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 45] });
  const bar1_translate = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const bar2_opacity = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const bar3 = menuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] });
  const bar3_translate = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(menuAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };
  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false
      }),
      Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: false })
    ]).start(() => setSidebarOpen(false));
  };

  // Main state
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [passkey, setPasskey] = useState('');
  const [joinPasskey, setJoinPasskey] = useState('');
  const [isInSession, setIsInSession] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pollingInterval = useRef<number | null>(null);

  // Sidebar nav
  const handleSidebarNav = async (item: SidebarTab) => {
    closeSidebar();
    if (item.route === 'logout') {
      await AsyncStorage.clear();
      setTimeout(() => {
        (navigation as any).reset?.({ index: 0, routes: [{ name: 'index' }], });
      }, 300);
    } else {
      (navigation as any).navigate?.(item.route);
    }
  };

  // Effects and helpers
  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        try { setUser(JSON.parse(str)); } catch { }
      }
    });
  }, []);
  useFocusEffect(React.useCallback(() => {
    if (isInSession && passkey) fetchSessionFiles(passkey, true);
  }, [isInSession, passkey]));
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

  const fetchSessionFiles = async (currentPasskey: string, silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await axios.get(`${config.url}/api/sessions/files/${currentPasskey}`);
      setFiles(prev => JSON.stringify(prev) !== JSON.stringify(response.data || []) ? (response.data || []) : prev);
    } catch (error: any) {
      if (!silent) Toast.show({ type: 'error', text1: 'Failed to fetch files: ' + (error.response?.data?.message || error.message) });
    } finally { if (!silent) setIsLoading(false); }
  };
  const generatePasskey = async () => {
    if (!user?.username) {
      Toast.show({ type: 'error', text1: 'Please log in to create a session' }); return;
    }
    setIsLoading(true); const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setPasskey(result);
    try {
      await axios.post(`${config.url}/api/sessions/create`, { passkey: result, username: user.username });
      setIsInSession(true); Toast.show({ type: 'success', text1: `Session created with passkey: ${result}` });
      await fetchSessionFiles(result, true);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed to create session: ' + (error.response?.data?.message || error.message) });
      setPasskey('');
    } finally { setIsLoading(false); }
  };
  const handleJoin = async () => {
    if (!user?.username) { Toast.show({ type: 'error', text1: 'Please log in to join a session' }); return; }
    if (!joinPasskey.trim()) { Toast.show({ type: 'error', text1: 'Please enter a passkey' }); return; }
    setIsLoading(true);
    try {
      await axios.post(`${config.url}/api/sessions/join`, { passkey: joinPasskey.trim(), username: user.username });
      setPasskey(joinPasskey.trim()); setIsInSession(true);
      Toast.show({ type: 'success', text1: 'Joined session!' });
      await fetchSessionFiles(joinPasskey.trim(), true);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed to join session: ' + (error.response?.data?.message || error.message) });
    } finally { setIsLoading(false); setJoinPasskey(''); }
  };
  const copyPasskey = async () => {
    if (!passkey) return;
    await Clipboard.setStringAsync(passkey);
    Toast.show({ type: 'success', text1: 'Passkey copied to clipboard!' });
  };
  const handleFileUpload = async () => {
    const options = ['Pick Document', 'Pick Photo', 'Cancel'];
    const cancelButtonIndex = 2;
    showActionSheetWithOptions(
      {
        options, cancelButtonIndex, title: 'Upload',
        message: 'Choose what you want to share',
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      async (buttonIndex) => {
        if (buttonIndex === 0) await _handleDocumentPick();
        if (buttonIndex === 1) await _handlePhotoPick();
      }
    );
  };
  const _handleDocumentPick = async () => {
    if (!user?.id || !passkey) { Toast.show({ type: 'error', text1: 'Please log in and join/create session to upload files' }); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return; const file = res.assets[0];
      let fileSize: number = typeof file.size === 'number' ? file.size : 0;
      if (!fileSize && file.uri) {
        const info = await FileSystem.getInfoAsync(file.uri); if (info.exists && typeof info.size === 'number') fileSize = info.size;
      }
      if (fileSize > 10 * 1024 * 1024) { Toast.show({ type: 'error', text1: 'File size must be less than 10MB.' }); return; }
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.mimeType || 'application/octet-stream', name: file.name || `upload.${(file.mimeType || '').split('/')[1] || 'bin'}` } as any);
      const tempId = `temp-${Date.now()}`; setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));
      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt: any) => { const percent = Math.round(100 * (evt.loaded / evt.total)); setUploadProgress((p) => ({ ...p, [tempId]: percent })); },
      });
      Toast.show({ type: 'success', text1: 'File uploaded successfully' });
      await fetchSessionFiles(passkey, true);
      setTimeout(() => setUploadProgress((prev) => { const p = { ...prev }; delete p[tempId]; return p; }), 1000);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed to upload file: ' + (error.response?.data?.message || error.message) });
    }
  };
  const _handlePhotoPick = async () => {
    if (!user?.id || !passkey) { Toast.show({ type: 'error', text1: 'Please log in and join/create session to upload photos' }); return; }
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
        const info = await FileSystem.getInfoAsync(asset.uri); if (info.exists && typeof info.size === 'number') fileSize = info.size;
      }
      if (fileSize > 10 * 1024 * 1024) { Toast.show({ type: 'error', text1: 'Image must be less than 10MB.' }); return; }
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.fileName || 'photo.jpg', } as any);
      const tempId = `temp-${Date.now()}`; setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));
      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt: any) => { const percent = Math.round(100 * (evt.loaded / evt.total)); setUploadProgress((p) => ({ ...p, [tempId]: percent })); },
      });
      Toast.show({ type: 'success', text1: 'Photo uploaded successfully' });
      await fetchSessionFiles(passkey, true);
      setTimeout(() => setUploadProgress((prev) => { const p = { ...prev }; delete p[tempId]; return p; }), 1000);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed to upload photo: ' + (error.response?.data?.message || error.message) });
    }
  };
  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      setDownloadProgress((prev) => ({ ...prev, [fileId]: 0 }));
      Toast.show({ type: 'info', text1: 'Download started...' });
      const downloadUrlResp = await axios.get(`${config.url}/api/sessions/download/${fileId}`, { responseType: 'json' });
      const url = downloadUrlResp.data?.url ?? `${config.url}/api/sessions/download/${fileId}`;
      const localUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${fileName}`;
      const downloadObj = FileSystem.createDownloadResumable(url, localUri, {}, (progress) => {
        const percent = Math.floor(100 * (progress.totalBytesWritten / (progress.totalBytesExpectedToWrite ?? 1)));
        setDownloadProgress((prev) => ({ ...prev, [fileId]: percent }));
      });
      const ret = await downloadObj.downloadAsync();
      if (ret?.uri) {
        await Sharing.shareAsync(ret.uri, { mimeType: undefined, dialogTitle: 'Save or share file', UTI: undefined, });
        Toast.show({ type: 'success', text1: 'Download complete!' });
      } else { throw new Error('Failed.'); }
      setTimeout(() => setDownloadProgress((prev) => { const n = { ...prev }; delete n[fileId]; return n; }), 800);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed to download: ' + (error.response?.data?.message || error.message) });
    }
  };


  const width = Dimensions.get('window').width;
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '359deg'] });

  // --- Sidebar render ---
  const renderSidebar = () => (
    <Animated.View
      style={[
        styles.sidebar,
        {
          backgroundColor: isDark ? '#141528' : '#fff',
          shadowColor: '#000',
          left: sidebarAnim,
        }
      ]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ marginBottom: 40, paddingHorizontal: 22 }}>
        <MaterialCommunityIcons name="folder" size={43} color={isDark ? '#8ab4f8' : '#2563eb'} style={{ marginBottom: 16 }} />
        <Text style={{ color: isDark ? '#fff' : '#222', fontSize: 21, fontWeight: '700' }}>Menu</Text>
      </View>
      {sidebarTabs.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.sidebarTab}
          activeOpacity={0.6}
          onPress={() => handleSidebarNav(item)}
        >
          <MaterialCommunityIcons name={item.icon} size={24} color={isDark ? '#8ab4f8' : '#2563eb'} style={{ marginRight: 12 }} />
          <Text style={{ fontSize: 16, color: isDark ? '#fff' : '#182242', fontWeight: '600' }}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );

  // === ALL UI BELOW
  return (
    <View style={{ flex: 1 }}>
      {sidebarOpen && (<TouchableOpacity style={styles.sidebarOverlay} onPress={closeSidebar} activeOpacity={1} />)}
      {renderSidebar()}
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: isDark ? '#181824' : '#e7effe' }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={sidebarOpen ? closeSidebar : openSidebar}
          activeOpacity={0.8}
        >
          {/* Hamburger/X Animation */}
          <Animated.View style={[styles.menuBar, {
            transform: [
              { rotateZ: bar1.interpolate({ inputRange: [0, 45], outputRange: ['0deg', '45deg'] }) },
              { translateY: bar1_translate }
            ],
            backgroundColor: isDark ? "#8ab4f8" : "#2563eb"
          }]} />
          <Animated.View style={[
            styles.menuBar,
            { opacity: bar2_opacity, backgroundColor: isDark ? "#8ab4f8" : "#2563eb" }
          ]} />
          <Animated.View style={[styles.menuBar, {
            transform: [
              { rotateZ: bar3 },
              { translateY: bar3_translate }
            ],
            backgroundColor: isDark ? "#8ab4f8" : "#2563eb"
          }]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#222" }]}>PassShare</Text>
        <View style={{ width: 44 }} />
      </View>
      {/* Main UI */}
      {(!user) ? (
        <View style={[styles.root, { backgroundColor: isDark ? '#181824' : '#F5F5F5' }]}>
          <View style={styles.notLoggedInCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={58} color={isDark ? "#8ab4f8" : "#007AFF"} style={{ marginBottom: 20 }} />
            <Text style={{ color: isDark ? "#fff" : "#222", fontSize: 20, fontWeight: '700', textAlign: 'center' }}>You must login first</Text>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate?.('login')}
              style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight, { marginTop: 23, width: 180 }]}
            >
              <Text style={styles.buttonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
          <Toast />
        </View>
      ) : isLoading ? (
        <View style={[styles.root, styles.rootCenter, { backgroundColor: isDark ? '#181824' : '#0A0A0A', zIndex: 2 }]}>
          <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 22 }}>
            <MaterialCommunityIcons name="upload" size={64} color={isDark ? "#8ab4f8" : "#2563eb"} />
          </Animated.View>
          <Text style={{ color: isDark ? "#8ab4f8" : "#2563eb", fontWeight: '700', fontSize: 18, marginTop: 3 }}>Connecting to secure channel...</Text>
          <Toast />
        </View>
      ) : !isInSession ? (
        <View style={{ flex: 1, backgroundColor: isDark ? '#181824' : '#0A0A0A', justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 49 }}>
            <View style={[
              styles.iconCircle,
              { backgroundColor: (isDark ? '#8ab4f81A' : "#2563eb20"), marginBottom: 16 }
            ]}>
              <MaterialCommunityIcons name="upload" size={60} color={isDark ? "#8ab4f8" : "#2563eb"} />
            </View>
            <Text style={[styles.modalTitle, { color: "#fff", marginBottom: 7 }]}>Secure File Sharing</Text>
            <Text style={{ color: "#b0b3bf", fontSize: 15 }}>Share files securely with a generated passkey</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 20, width: width > 720 ? 700 : '96%', alignSelf: 'center' }}>
            <View style={[styles.sessionCard, { flex: 1 }]}>
              <Text style={styles.sessionCardTitle}>Create Share</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <TextInput
                  style={[styles.sessionPasskeyInput, { color: '#fff', flex: 1 }]}
                  value={passkey}
                  editable={false}
                  placeholder="Generated passkey"
                  placeholderTextColor="#b0b3bf"
                />
                {!!passkey && (
                  <TouchableOpacity
                    onPress={copyPasskey}
                    hitSlop={10}
                    style={{ padding: 7, borderRadius: 6, marginLeft: 6, backgroundColor: 'rgba(51,132,255,0.13)' }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={20} color={isDark ? "#8ab4f8" : "#007AFF"} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight]}
                onPress={generatePasskey}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Generate Passkey</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.sessionCard, { flex: 1 }]}>
              <Text style={styles.sessionCardTitle}>Join Share</Text>
              <TextInput
                style={[styles.sessionPasskeyInput, { color: '#fff', marginBottom: 14 }]}
                value={joinPasskey}
                onChangeText={setJoinPasskey}
                placeholder="Enter passkey"
                placeholderTextColor="#b0b3bf"
                editable={!isLoading}
                autoCapitalize="characters"
                returnKeyType="go"
                onSubmitEditing={handleJoin}
              />
              <TouchableOpacity
                style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight]}
                onPress={handleJoin}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Join Session</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Toast />
        </View>
      ) : (
        // -- IN SESSION UI --
        <View style={{ flex: 1, backgroundColor: isDark ? '#181824' : '#0A0A0A', alignItems: 'center', paddingBottom: 40, paddingTop: 20 }}>
          {/* Header: Passkey Display */}
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: (isDark ? '#8ab4f81A' : "#2563eb20") }]}>
              <MaterialCommunityIcons name="key-variant" size={54} color={isDark ? "#8ab4f8" : "#2563eb"} />
            </View>
            <Text style={[styles.modalTitle, { color: "#fff", marginBottom: 6 }]}>Secure File Sharing Session</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: "#b0b3bf", fontSize: 15 }}>
                Passkey: <Text style={{ fontFamily: 'Courier', color: '#fff', fontWeight: '700' }}>{passkey}</Text>
              </Text>
              <TouchableOpacity
                onPress={copyPasskey}
                hitSlop={10}
                style={{ padding: 6, borderRadius: 6, marginLeft: 7, backgroundColor: 'rgba(51,132,255,0.13)' }}
              >
                <MaterialCommunityIcons name="content-copy" size={19} color={isDark ? "#8ab4f8" : "#007AFF"} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Upload area */}
          <View style={[styles.uploadArea, isDark ? { backgroundColor: '#23243A' } : { backgroundColor: '#e6edfe' }]}>
            <TouchableOpacity
              style={styles.uploadButtonArea}
              onPress={handleFileUpload}
            >
              <MaterialCommunityIcons name="upload" size={35} color={isDark ? "#8ab4f8" : "#2563eb"} style={{ marginBottom: 5 }} />
              <Text style={{ color: isDark ? '#fff' : '#333', fontWeight: '600', fontSize: 16 }}>Upload</Text>
            </TouchableOpacity>
            <Text style={{ color: isDark ? "#b0b3bf" : "#4b5563", fontSize: 13, marginTop: 6, textAlign: 'center' }}>Upload a document or photo under 10MB</Text>
          </View>
          {/* Files list */}
          <View style={[styles.filesCard, isDark ? { backgroundColor: '#191a26' } : { backgroundColor: '#fff' }]}>
            <Text style={{
              color: isDark ? "#fff" : "#222",
              fontWeight: '700', fontSize: 18, marginBottom: 9, letterSpacing: 0.1
            }}>Shared Files</Text>
            {(!files || files.length === 0) &&
              <Text style={{ color: "#b0b3bf", textAlign: 'center', paddingVertical: 18 }}>No files shared yet.</Text>
            }
            <FlatList
              style={{ width: '100%', marginBottom: 2 }}
              data={files || []}
              keyExtractor={item => item.id?.toString()}
              renderItem={({ item }) =>
                item && (
                  <View style={styles.fileRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="file-upload-outline" size={26} color={isDark ? "#8ab4f8" : "#2563eb"} style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '500', fontSize: 15 }} numberOfLines={1}>{item.fileName}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 70, justifyContent: 'flex-end' }}>
                      {(uploadProgress[item.id] > 0 || downloadProgress[item.id] > 0) &&
                        <View style={{
                          width: 44, height: 6, backgroundColor: "#26293b", borderRadius: 3,
                          marginRight: 7, overflow: 'hidden'
                        }}>
                          <View style={{
                            backgroundColor: isDark ? "#8ab4f8" : "#2563eb",
                            height: 6, borderRadius: 3, width: `${uploadProgress[item.id] ?? downloadProgress[item.id] ?? 0}%`
                          }} />
                        </View>
                      }
                      <TouchableOpacity
                        style={{ padding: 7, borderRadius: 5, backgroundColor: 'rgba(51,132,255,0.13)' }}
                        onPress={() => handleDownload(item.id, item.fileName)}
                      >
                        <MaterialCommunityIcons name="download" size={23} color={isDark ? "#8ab4f8" : "#007AFF"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              }
              ListFooterComponent={<View style={{ height: 10 }} />}
              contentContainerStyle={files.length === 0 ? {} : { paddingBottom: 10 }}
            />
          </View>
          <Toast />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    zIndex: 100,
    paddingTop: 46,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: '#1e2630',
    shadowRadius: 15,
    elevation: 20,
  },
  sidebarTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 1,
    borderRadius: 8,
    marginRight: 14
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1c1c28b2',
    zIndex: 99
  },
  menuButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 4, marginRight: 9
  },
  menuBar: {
    width: 29, height: 3.6, borderRadius: 3,
    marginVertical: 2, marginHorizontal: 0, backgroundColor: '#2563eb'
  },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 10,
    paddingBottom: 15, paddingHorizontal: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#282a3b',
    zIndex: 0
  },
  headerTitle: {
    flex: 1, textAlign: 'center', fontWeight: "bold", fontSize: 22,
    letterSpacing: 0.11
  },
  root: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
    backgroundColor: '#181824',
  },
  rootCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
  },
  notLoggedInCard: {
    marginTop: '25%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: 330,
    minHeight: 320,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 22,
  },
  iconCircle: {
    borderRadius: 9999,
    padding: 18,
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 26,
    marginBottom: 8,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  sessionCard: {
    flex: 1,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    marginHorizontal: 5,
    marginVertical: 10,
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 14,
  },
  sessionCardTitle: {
    fontWeight: 'bold',
    fontSize: 19,
    color: '#fff',
    marginBottom: 9,
    letterSpacing: 0.19,
  },
  sessionPasskeyInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
    backgroundColor: '#252436',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: '#3b425a',
    borderWidth: 1,
    marginBottom: 7,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: 'center',
    marginTop: 2,
    width: "100%",
    marginBottom: 2,
  },
  buttonLight: {
    backgroundColor: '#007AFF',
  },
  buttonDark: {
    backgroundColor: '#8ab4f8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  headerSection: {
    alignItems: 'center', marginBottom: 20,
  },
  uploadArea: {
    justifyContent: 'center', alignItems: 'center', padding: 18,
    borderRadius: 11, marginVertical: 12, width: '94%',
    alignSelf: 'center',
    minHeight: 120,
  },
  uploadButtonArea: {
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 10,
  },
  filesCard: {
    paddingVertical: 22, paddingHorizontal: 18,
    borderRadius: 14,
    width: '95%',
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 6,
    shadowColor: '#122',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    minHeight: 90
  },
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomColor: 'rgba(180,180,200,0.07)', borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    minHeight: 48,
    gap: 8,
  },
});
