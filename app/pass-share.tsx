// PassShare.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  Clipboard,
  ActionSheetIOS,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import config from './config'; // Import config

const { width } = Dimensions.get('window');

interface User {
  id: string;
  username: string;
}

interface FileItem {
  id: string;
  fileName: string;
  size: number;
  uploaderUsername: string;
  uploadDate: string;
}

interface UploadProgress {
  [key: string]: number;
}

const PassShare: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [passkey, setPasskey] = useState<string>('');
  const [joinPasskey, setJoinPasskey] = useState<string>('');
  const [isInSession, setIsInSession] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [downloadProgress, setDownloadProgress] = useState<UploadProgress>({});

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        // For testing purposes, create a dummy user if none exists
        const dummyUser = { id: '1', username: 'testuser' };
        await AsyncStorage.setItem('user', JSON.stringify(dummyUser));
        setUser(dummyUser);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Alert.alert(type === 'success' ? 'Success' : 'Error', message);
  };

  const generatePasskey = async () => {
    if (!user || !user.username) {
      showToast('Please log in to create a session', 'error');
      return;
    }

    setIsLoading(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasskey(result);

    try {
      await axios.post(`${config.url}/api/sessions/create`, {
        passkey: result,
        username: user.username,
      });
      setIsInSession(true);
      showToast(`Session created with passkey: ${result}`);
      fetchSessionFiles(result);
    } catch (error: any) {
      showToast('Failed to create session: ' + (error.response?.data?.message || error.message), 'error');
      setPasskey('');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPasskey = async () => {
    if (passkey) {
      try {
        if (Platform.OS === 'web') {
          await navigator.clipboard.writeText(passkey);
        } else {
          Clipboard.setString(passkey);
        }
        showToast('Passkey copied to clipboard!');
      } catch (error) {
        showToast('Failed to copy passkey', 'error');
      }
    }
  };

  const handleJoin = async () => {
    if (!user || !user.username) {
      showToast('Please log in to join a session', 'error');
      return;
    }

    if (!joinPasskey.trim()) {
      showToast('Please enter a passkey', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${config.url}/api/sessions/join`, {
        passkey: joinPasskey,
        username: user.username,
      });
      setPasskey(joinPasskey);
      setIsInSession(true);
      showToast('Joined session!');
      fetchSessionFiles(joinPasskey);
    } catch (error: any) {
      showToast('Failed to join session: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setIsLoading(false);
      setJoinPasskey('');
    }
  };

  const fetchSessionFiles = async (sessionPasskey: string) => {
    try {
      const response = await axios.get(`${config.url}/api/sessions/files/${sessionPasskey}`);
      setFiles(response.data);
    } catch (error: any) {
      showToast('Failed to fetch files: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  const uploadFile = async (fileUri: string, fileName: string, mimeType: string, fileSize?: number) => {
    console.log('Uploading file:', { fileUri, fileName, mimeType, fileSize });
    
    if (!user || !user.id) {
      showToast('Please log in to upload files', 'error');
      return;
    }

    if (fileSize && fileSize > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB.', 'error');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);

    try {
      await axios.post(`${config.url}/api/sessions/upload/${passkey}/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress((prev) => ({ ...prev, [tempId]: percentCompleted }));
          }
        },
      });
      showToast('File uploaded successfully');
      fetchSessionFiles(passkey);
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast('Failed to upload file: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[tempId];
        return newProgress;
      });
    }
  };

  const requestPermissionAndExecute = async (action: () => Promise<void>, permissionType: 'camera' | 'library') => {
    try {
      let permissionResult;
      if (permissionType === 'camera') {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (permissionResult.status === 'granted') {
        await action();
      } else {
        const permissionName = permissionType === 'camera' ? 'Camera' : 'Photo Library';
        showToast(`${permissionName} permission is required for this feature`, 'error');
      }
    } catch (error) {
      console.error(`Permission error for ${permissionType}:`, error);
      showToast(`Failed to request ${permissionType} permission`, 'error');
    }
  };

  const pickFromGallery = async () => {
    console.log('Pick from gallery triggered');
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      console.log('Gallery picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Selected asset:', asset);
        
        const fileName = asset.uri.split('/').pop() || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
        const mimeType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
        
        await uploadFile(asset.uri, fileName, mimeType, asset.fileSize);
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      showToast('Failed to pick from gallery: ' + (error as Error).message, 'error');
    }
  };

  const pickFromFiles = async () => {
    console.log('Pick from files triggered');
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: Platform.OS === 'ios' ? false : true,
        multiple: false,
      });

      console.log('Document picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('Selected file:', file);
        
        // Enhanced MIME type detection
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        let mimeType = file.mimeType || 'application/octet-stream';
        
        // iOS sometimes doesn't provide MIME type, so we detect it
        if (!file.mimeType || file.mimeType === 'application/octet-stream') {
          switch (fileExtension) {
            case 'pdf':
              mimeType = 'application/pdf';
              break;
            case 'jpg':
            case 'jpeg':
              mimeType = 'image/jpeg';
              break;
            case 'png':
              mimeType = 'image/png';
              break;
            case 'gif':
              mimeType = 'image/gif';
              break;
            case 'webp':
              mimeType = 'image/webp';
              break;
            case 'mp4':
              mimeType = 'video/mp4';
              break;
            case 'mov':
              mimeType = 'video/quicktime';
              break;
            case 'avi':
              mimeType = 'video/x-msvideo';
              break;
            case 'doc':
              mimeType = 'application/msword';
              break;
            case 'docx':
              mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              break;
            case 'xls':
              mimeType = 'application/vnd.ms-excel';
              break;
            case 'xlsx':
              mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              break;
            case 'ppt':
              mimeType = 'application/vnd.ms-powerpoint';
              break;
            case 'pptx':
              mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
              break;
            case 'txt':
              mimeType = 'text/plain';
              break;
            case 'rtf':
              mimeType = 'application/rtf';
              break;
            case 'zip':
              mimeType = 'application/zip';
              break;
            case 'rar':
              mimeType = 'application/vnd.rar';
              break;
            default:
              mimeType = 'application/octet-stream';
          }
        }
        
        await uploadFile(file.uri, file.name, mimeType, file.size);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      showToast('Failed to pick file: ' + (error as Error).message, 'error');
    }
  };

  const takePhoto = async () => {
    console.log('Take photo triggered');
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        aspect: [4, 3],
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Captured photo:', asset);
        
        const fileName = `photo_${Date.now()}.jpg`;
        
        await uploadFile(asset.uri, fileName, 'image/jpeg', asset.fileSize);
      }
    } catch (error) {
      console.error('Camera error:', error);
      showToast('Failed to take photo: ' + (error as Error).message, 'error');
    }
  };

  const handleFileUpload = () => {
    console.log('File upload button pressed');
    
    if (Platform.OS === 'ios') {
      // Use native iOS ActionSheet
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery', 'Browse Files'],
          cancelButtonIndex: 0,
          title: 'Select File Source',
          message: 'Choose how you want to add files',
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1: // Take Photo
              requestPermissionAndExecute(takePhoto, 'camera');
              break;
            case 2: // Choose from Gallery
              requestPermissionAndExecute(pickFromGallery, 'library');
              break;
            case 3: // Browse Files
              pickFromFiles();
              break;
            default:
              // Cancel pressed
              break;
          }
        }
      );
    } else {
      // For Android, use Alert with options
      Alert.alert(
        'Select File Source',
        'Choose how you want to add files',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Take Photo', 
            onPress: () => requestPermissionAndExecute(takePhoto, 'camera')
          },
          { 
            text: 'Choose from Gallery', 
            onPress: () => requestPermissionAndExecute(pickFromGallery, 'library')
          },
          { 
            text: 'Browse Files', 
            onPress: pickFromFiles
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    setDownloadProgress((prev) => ({ ...prev, [fileId]: 0 }));
    
    try {
      const downloadUri = `${config.url}/api/file/download/${fileId}`;
      const fileUri = FileSystem.documentDirectory + fileName;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUri,
        fileUri,
        {},
        (downloadProgress) => {
          if (downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            const percentCompleted = Math.round(progress * 100);
            setDownloadProgress((prev) => ({ ...prev, [fileId]: percentCompleted }));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri);
        }
        showToast(`Downloaded ${fileName}`);
      }
    } catch (error: any) {
      console.error('Download error:', error);
      showToast('Failed to download file: ' + error.message, 'error');
    } finally {
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    }
  };

  const leaveSession = () => {
    setIsInSession(false);
    setPasskey('');
    setFiles([]);
    setUploadProgress({});
    setDownloadProgress({});
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Connecting to secure channel...</Text>
      </View>
    );
  }

  if (!isInSession) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-upload" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Secure File Sharing</Text>
          <Text style={styles.subtitle}>Share files securely with a generated passkey</Text>
        </View>

        <View style={styles.featureGrid}>
          <View style={styles.featureCard}>
            <Ionicons name="cloud-upload-outline" size={32} color="#FFFFFF" />
            <Text style={styles.featureTitle}>Send Files</Text>
            <Text style={styles.featureSubtitle}>Share files with others</Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="cloud-download-outline" size={32} color="#FFFFFF" />
            <Text style={styles.featureTitle}>Receive Files</Text>
            <Text style={styles.featureSubtitle}>Get files from others</Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="time-outline" size={32} color="#FFFFFF" />
            <Text style={styles.featureTitle}>Share History</Text>
            <Text style={styles.featureSubtitle}>View recent transfers</Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Share</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={passkey}
                placeholder="Generated passkey"
                placeholderTextColor="#9CA3AF"
                editable={false}
              />
              {passkey && (
                <TouchableOpacity onPress={copyPasskey} style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={generatePasskey}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Generate Passkey</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join Share</Text>
            <TextInput
              style={styles.input}
              value={joinPasskey}
              onChangeText={setJoinPasskey}
              placeholder="Enter passkey"
              placeholderTextColor="#9CA3AF"
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Join Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.sessionHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="key" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Secure File Sharing Session</Text>
        <View style={styles.passkeyContainer}>
          <Text style={styles.passkeyLabel}>Passkey: </Text>
          <Text style={styles.passkeyValue}>{passkey}</Text>
          <TouchableOpacity onPress={copyPasskey} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.leaveButton} onPress={leaveSession}>
          <Text style={styles.leaveButtonText}>Leave Session</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.uploadArea} onPress={handleFileUpload}>
        <Ionicons name="cloud-upload" size={48} color="#FFFFFF" />
        <Text style={styles.uploadText}>Tap to upload files</Text>
        <Text style={styles.uploadSubtext}>PNG, JPEG, PDF, MP4, DOCX (Max 10MB)</Text>
      </TouchableOpacity>

      <View style={styles.filesContainer}>
        <Text style={styles.filesTitle}>Shared Files</Text>
        {files.length === 0 ? (
          <Text style={styles.noFilesText}>No files shared yet.</Text>
        ) : (
          files.map((file) => (
            <View key={file.id} style={styles.fileCard}>
              <View style={styles.fileInfo}>
                <Ionicons name="document" size={24} color="#FFFFFF" />
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName}>{file.fileName}</Text>
                  <Text style={styles.fileSize}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB • Uploaded by {file.uploaderUsername}
                  </Text>
                </View>
              </View>
              <View style={styles.fileActions}>
                {(uploadProgress[file.id] > 0 || downloadProgress[file.id] > 0) && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${uploadProgress[file.id] || downloadProgress[file.id] || 0}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {uploadProgress[file.id] || downloadProgress[file.id] || 0}%
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownload(file.id, file.fileName)}
                >
                  <Ionicons name="download" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 20,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 50,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: (width - 60) / 3,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  actionContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  copyButton: {
    padding: 12,
    marginLeft: 8,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  passkeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  passkeyLabel: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  passkeyValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 30,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  filesContainer: {
    marginTop: 20,
  },
  filesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  noFilesText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  fileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  fileActions: {
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  downloadButton: {
    padding: 8,
  },
});

export default PassShare;
