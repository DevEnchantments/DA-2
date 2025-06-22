// app/AIChatScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../configs/firebaseConfig';
import AnimatedMessageBubble from './components/AnimatedMessageBubble';
import EmojiPickerButton from './components/EmojiPickerButton';
import { sendMessageToOpenAI } from './services/openai';
import { groupMessagesByDate } from './utils/messageGrouping';

export default function AIChatScreen() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const flatRef = useRef();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [aiTyping, setAiTyping] = useState(false);

  // Listen for AI chat messages
  useEffect(() => {
    if (!currentUid) return;

    const q = query(
      collection(db, 'aiChats', currentUid, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });

      // Group messages by date
      setMessages(groupMessagesByDate(docs));
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUid]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Send message to    AI
  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !currentUid || aiTyping) return;

    try {
      // Add user message to Firestore
      await addDoc(collection(db, 'aiChats', currentUid, 'messages'), {
        text: trimmed,
        sender: 'user',
        createdAt: serverTimestamp(),
      });

      setInputText('');
      setAiTyping(true);

      // Get AI response
      const aiResponse = await sendMessageToOpenAI(trimmed);

      // Add AI response to Firestore
      await addDoc(collection(db, 'aiChats', currentUid, 'messages'), {
        text: aiResponse,
        sender: 'ai',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to send message to AI:', error);
      Alert.alert(
        'Error',
        'Failed to get AI response. Please check your internet connection and try again.'
      );
    } finally {
      setAiTyping(false);
    }
  };

  // Quick suggestion buttons
  const quickSuggestions = [
    "What's a healthy breakfast for weight loss?",
    "How many calories should I eat daily?",
    "What foods are good for diabetes?",
    "Can you suggest a meal plan?",
  ];

  const sendQuickMessage = (suggestion) => {
    setInputText(suggestion);
  };

  if (!currentUid) {
    return (
      <View style={styles.center}>
        <Text>Please log in to access AI chat.</Text>
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

    const isUser = item.sender === 'user';
    const showAvatar =
      index === 0 ||
      messages[index - 1].type !== 'message' ||
      messages[index - 1].sender !== item.sender;

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userContainer : styles.aiContainer,
        ]}
      >
        {showAvatar && !isUser && (
          <View style={styles.aiAvatarContainer}>
            <Text style={styles.aiAvatar}>🤖</Text>
          </View>
        )}
        
        <AnimatedMessageBubble
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAI,
            showAvatar
              ? isUser
                ? styles.tailUser
                : styles.tailAI
              : null,
          ]}
        >
          {!isUser && showAvatar && (
            <Text style={styles.aiNameText}>AI Medical Assistant</Text>
          )}

          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.text}
          </Text>

          <Text style={[styles.timeText, isUser && styles.userTimeText]}>
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
          <View style={styles.aiHeaderAvatar}>
            <Text style={styles.aiHeaderAvatarText}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerName}>AI Medical Assistant</Text>
            <Text style={styles.headerStatus}>
              {aiTyping ? 'Typing...' : 'Online • Ready to help'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading AI chat...</Text>
        </View>
      ) : (
        <>
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

          {/* Quick Suggestions (show when no messages) */}
          {messages.length === 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Quick Questions:</Text>
              {quickSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => sendQuickMessage(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* AI Typing Indicator */}
          {aiTyping && (
            <View style={styles.typingContainer}>
              <View style={styles.aiAvatarContainer}>
                <Text style={styles.aiAvatar}>🤖</Text>
              </View>
              <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Input Bar */}
      <View style={styles.inputRow}>
        <EmojiPickerButton onSelect={(emoji) => setInputText((prev) => prev + emoji)} />
        
        <TextInput
          style={styles.input}
          placeholder="Ask me about nutrition, meal planning, or health..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={1000}
        />
        
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: inputText.trim() && !aiTyping ? 1 : 0.5 }]}
          onPress={sendMessage}
          disabled={!inputText.trim() || aiTyping}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
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
  aiHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiHeaderAvatarText: {
    fontSize: 20,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerStatus: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 80,
  },
  separatorText: { 
    textAlign: 'center', 
    marginVertical: 12, 
    color: '#888',
    fontSize: 12,
    fontWeight: '500'
  },
  messageContainer: { 
    flexDirection: 'row', 
    marginVertical: 2,
    alignItems: 'flex-end',
  },
  userContainer: { 
    justifyContent: 'flex-end',
    marginLeft: 50,
  },
  aiContainer: { 
    justifyContent: 'flex-start',
    marginRight: 50,
  },
  aiAvatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  aiAvatar: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleUser: { 
    backgroundColor: '#4CAF50', 
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  bubbleAI: { 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  tailUser: { 
    borderBottomRightRadius: 4 
  },
  tailAI: { 
    borderBottomLeftRadius: 4 
  },
  aiNameText: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginBottom: 4,
    color: '#FF9800'
  },
  messageText: { 
    fontSize: 16,
    lineHeight: 20,
    color: '#333'
  },
  userMessageText: {
    color: '#fff'
  },
  timeText: { 
    fontSize: 10, 
    color: '#999', 
    marginTop: 6, 
    textAlign: 'right' 
  },
  userTimeText: {
    color: 'rgba(255,255,255,0.8)'
  },
  suggestionsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  suggestionButton: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#666',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginHorizontal: 2,
  },
  dot1: { animationDelay: '0s' },
  dot2: { animationDelay: '0.2s' },
  dot3: { animationDelay: '0.4s' },
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
  sendBtn: {
    backgroundColor: '#FF9800',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
