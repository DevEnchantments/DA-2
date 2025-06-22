// app/(Tabs)/chat/[contactId].js
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  orderBy,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, storage } from '../../../configs/firebaseConfig';
import AnimatedMessageBubble from '../../components/AnimatedMessageBubble';
import EmojiPickerButton from '../../components/EmojiPickerButton';
import { groupMessagesByDate } from '../../utils/messageGrouping';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAX_W = SCREEN_W * 0.75;
const MAX_H = SCREEN_H * 0.5;
const INPUT_BAR_HEIGHT = 60;

// Helper function to format file sizes
function formatBytes(bytes) {
  if (bytes == null) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

export default function ChatRoom() {
  const { contactId } = useLocalSearchParams();
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const flatRef = useRef();

  const [myProfile, setMyProfile] = useState(null);
  const [contactProfile, setContactProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Load user profiles
  useEffect(() => {
    if (!contactId || !currentUid) return;
    
    (async () => {
      try {
        const [mine, theirs] = await Promise.all([
          getDoc(doc(db, 'users', currentUid)),
          getDoc(doc(db, 'users', contactId)),
        ]);
        
        if (mine.exists()) setMyProfile(mine.data());
        if (theirs.exists()) setContactProfile(theirs.data());
      } catch (error) {
        console.error('Error loading profiles:', error);
      }
    })();
  }, [contactId, currentUid]);

  // Listen for messages
  useEffect(() => {
    if (!contactId || !currentUid) return;

    // Query for messages between current user and contact
    const q1 = query(
      collection(db, 'messages'),
      where('senderId', '==', currentUid),
      where('recipientId', '==', contactId)
    );
    const q2 = query(
      collection(db, 'messages'),
      where('senderId', '==', contactId),
      where('recipientId', '==', currentUid)
    );

    let allMessages = [];

    const handleSnapshot = (snapshot, isFirstQuery) => {
      const docs = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });

      // Merge and deduplicate messages
      if (isFirstQuery) {
        allMessages = docs;
      } else {
        // Remove duplicates and add new messages
        allMessages = allMessages.filter((m) => !docs.some((nd) => nd.id === m.id));
        allMessages = [...allMessages, ...docs];
      }

      // Sort by creation time
      allMessages.sort((a, b) => a.createdAt - b.createdAt);
      
      // Group messages by date
      setMessages(groupMessagesByDate(allMessages));
      setLoading(false);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => handleSnapshot(snapshot, true));
    const unsubscribe2 = onSnapshot(q2, (snapshot) => handleSnapshot(snapshot, false));

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [contactId, currentUid]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Image picker and upload
  const pickAndSendImage = async () => {
    if (!currentUid || !contactId) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission required", "Camera roll permission is required!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setUploading(true);
      const { uri } = result.assets[0];
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${currentUid}_${Date.now()}.jpg`;
      const fileRef = ref(storage, `chatImages/${filename}`);
      
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      // Get image dimensions
      Image.getSize(
        downloadURL,
        (width, height) => {
          addDoc(collection(db, 'messages'), {
            senderId: currentUid,
            recipientId: contactId,
            createdAt: serverTimestamp(),
            fileUrl: downloadURL,
            fileType: 'image',
            fileName: filename,
            text: null,
            imageWidth: width,
            imageHeight: height,
          });
        },
        () => {
          // Fallback if getSize fails
          addDoc(collection(db, 'messages'), {
            senderId: currentUid,
            recipientId: contactId,
            createdAt: serverTimestamp(),
            fileUrl: downloadURL,
            fileType: 'image',
            fileName: filename,
            text: null,
          });
        }
      );
    } catch (error) {
      console.error('Image upload failed:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Document picker and upload
  const pickAndSendDocument = async () => {
    if (!currentUid || !contactId) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      
      let uri, name, size;
      if (result.type === 'success') {
        uri = result.uri;
        name = result.name;
        size = result.size;
      } else if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        uri = asset.uri;
        name = asset.name;
        size = asset.size;
      } else {
        return;
      }

      setUploading(true);
      const response = await fetch(uri);
      const blob = await response.blob();
      const storedName = `${currentUid}_${Date.now()}_${name}`;
      const fileRef = ref(storage, `chatDocs/${storedName}`);
      
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'messages'), {
        senderId: currentUid,
        recipientId: contactId,
        createdAt: serverTimestamp(),
        fileUrl: downloadURL,
        fileType: 'document',
        fileName: name,
        fileSize: size ?? blob.size,
        text: null,
      });
    } catch (error) {
      console.error('Document upload failed:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Send text message
  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !currentUid || !contactId) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUid,
        recipientId: contactId,
        createdAt: serverTimestamp(),
        text: trimmed,
        fileType: null,
        fileUrl: null,
      });
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  if (!currentUid) {
    return (
      <View style={styles.center}>
        <Text>Please log in to access chat.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Render message item
  const renderItem = ({ item, index }) => {
    if (item.type === 'separator') {
      return (
        <Text style={styles.separatorText}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      );
    }

    const isMe = item.senderId === currentUid;
    const profile = isMe ? myProfile : contactProfile;
    const showAvatar =
      index === 0 ||
      messages[index - 1].type !== 'message' ||
      messages[index - 1].senderId !== item.senderId;

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.outgoingContainer : styles.incomingContainer,
        ]}
      >
        {showAvatar && profile?.photoUrl && (
          <Image source={{ uri: profile.photoUrl }} style={styles.avatarAbove} />
        )}
        
        <AnimatedMessageBubble
          style={[
            styles.bubble,
            isMe ? styles.bubbleOutgoing : styles.bubbleIncoming,
            showAvatar
              ? isMe
                ? styles.tailOutgoing
                : styles.tailIncoming
              : null,
          ]}
        >
          {!isMe && showAvatar && profile && (
            <Text style={styles.nameText}>
              {profile.userType === 'doctor' ? 'Dr. ' : ''}{profile.firstName}
            </Text>
          )}

          {item.text && (
            <Text style={styles.messageText}>
              {item.text}
            </Text>
          )}

          {item.fileType === 'image' && item.imageWidth && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewUrl(item.fileUrl)}
              style={styles.imageContainer}
            >
              <Image
                source={{ uri: item.fileUrl }}
                style={{
                  width: Math.min(MAX_W, (MAX_H * item.imageWidth) / item.imageHeight),
                  height: Math.min(MAX_H, (MAX_W * item.imageHeight) / item.imageWidth),
                  borderRadius: 8,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {item.fileType === 'document' && (
            <View style={styles.docContainer}>
              <View style={styles.docInfo}>
                <Ionicons name="document-outline" size={24} color="#666" />
                <View style={styles.docDetails}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={styles.docSize}>
                    {formatBytes(item.fileSize)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(item.fileUrl, '_blank');
                  } else {
                    Linking.openURL(item.fileUrl);
                  }
                }}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.timeText}>
            {item.createdAt.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </AnimatedMessageBubble>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {contactProfile?.photoUrl && (
            <Image source={{ uri: contactProfile.photoUrl }} style={styles.headerAvatar} />
          )}
          <View>
            <Text style={styles.headerName}>
              {contactProfile?.userType === 'doctor' ? 'Dr. ' : ''}
              {contactProfile?.firstName} {contactProfile?.lastName}
            </Text>
            <Text style={styles.headerRole}>
              {contactProfile?.userType === 'doctor' ? 'Your Doctor' : 'Patient'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.type === 'separator' ? `sep_${item.date}` : item.id
        }
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
      />

      {/* Input Bar */}
      <View style={styles.inputRow}>
        <EmojiPickerButton onSelect={(emoji) => setInputText((prev) => prev + emoji)} />
        
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={1000}
        />
        
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={pickAndSendImage}
          disabled={uploading}
        >
          <Ionicons name="camera-outline" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={pickAndSendDocument}
          disabled={uploading}
        >
          <Ionicons name="attach-outline" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.5 }]}
          onPress={sendMessage}
          disabled={!inputText.trim() || uploading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadingIndicator}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      {/* Image preview modal */}
      <Modal
        visible={!!previewUrl}
        transparent
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity 
            style={styles.modalClose} 
            onPress={() => setPreviewUrl(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image 
            source={{ uri: previewUrl }} 
            style={styles.modalImage} 
            resizeMode="contain" 
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerRole: {
    fontSize: 12,
    color: '#666',
  },
  messagesList: {
    padding: 16,
    paddingBottom: INPUT_BAR_HEIGHT + 16,
  },
  separatorText: { 
    textAlign: 'center', 
    marginVertical: 12, 
    color: '#888',
    fontSize: 12,
    fontWeight: '500'
  },
  messageContainer: { 
    flexDirection: 'column', 
    marginVertical: 2 
  },
  incomingContainer: { 
    alignItems: 'flex-start' 
  },
  outgoingContainer: { 
    alignItems: 'flex-end' 
  },
  avatarAbove: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    marginBottom: 4, 
    marginHorizontal: 8 
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 8,
  },
  bubbleIncoming: { 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4 
  },
  bubbleOutgoing: { 
    backgroundColor: '#4CAF50', 
    borderBottomRightRadius: 4 
  },
  tailIncoming: { 
    borderBottomLeftRadius: 4 
  },
  tailOutgoing: { 
    borderBottomRightRadius: 4 
  },
  nameText: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginBottom: 4,
    color: '#666'
  },
  messageText: { 
    fontSize: 16,
    lineHeight: 20,
    color: '#333'
  },
  timeText: { 
    fontSize: 10, 
    color: '#999', 
    marginTop: 6, 
    textAlign: 'right' 
  },
  imageContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  docContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docDetails: {
    marginLeft: 8,
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  docSize: {
    fontSize: 12,
    color: '#666',
  },
  downloadBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  sendBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  uploadingIndicator: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  uploadingText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
  modalClose: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
