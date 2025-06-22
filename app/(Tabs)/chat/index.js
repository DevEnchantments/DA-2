// app/(Tabs)/chat/index.js
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../../configs/firebaseConfig";

export default function ChatScreen() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const isFocused = useIsFocused();

  const [myUserType, setMyUserType] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user type once
  useEffect(() => {
    async function fetchUserType() {
      if (!currentUid) return;
      
      try {
        const mySnap = await getDoc(doc(db, "users", currentUid));
        if (mySnap.exists()) {
          const userData = mySnap.data();
          // Use userType instead of role to match your app structure
          setMyUserType(userData.userType);
        }
      } catch (err) {
        console.error("Error fetching user type:", err);
      }
    }
    fetchUserType();
  }, [currentUid]);

  // Fetch contacts based on user type
  const fetchContacts = useCallback(async () => {
    if (!myUserType || !currentUid) return;

    setLoading(true);
    try {
      if (myUserType === "doctor") {
        // Doctor: get assigned patients using your existing structure
        const assignQ = query(
          collection(db, "doctorPatients"),
          where("doctorId", "==", currentUid)
        );
        const assignSnap = await getDocs(assignQ);
        const patientIds = assignSnap.docs.map((d) => d.data().patientId);

        let patientBatches = [];
        if (patientIds.length > 0) {
          // Get patient details (limit to 10 for Firestore 'in' query limit)
          const batchSize = 10;
          
          for (let i = 0; i < patientIds.length; i += batchSize) {
            const batch = patientIds.slice(i, i + batchSize);
            const patientsQ = query(
              collection(db, "users"),
              where("__name__", "in", batch)
            );
            const patientsSnap = await getDocs(patientsQ);
            const batchResults = patientsSnap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                uid: docSnap.id,
                firstName: d.firstName || '',
                lastName: d.lastName || '',
                photoUrl: d.photoUrl || null,
                userType: d.userType
              };
            });
            patientBatches.push(...batchResults);
          }
        }
        
        // Add AI Assistant to the list for doctors
        const contactsWithAI = [
          {
            uid: 'ai-assistant',
            firstName: 'AI Medical',
            lastName: 'Assistant',
            photoUrl: null,
            userType: 'ai',
            isAI: true
          },
          ...patientBatches
        ];
        setContacts(contactsWithAI);
        
      } else if (myUserType === "patient") {
        // Patient: get assigned doctor using your existing structure
        const assignQ = query(
          collection(db, "doctorPatients"),
          where("patientId", "==", currentUid)
        );
        const assignSnap = await getDocs(assignQ);

        // Add AI Assistant to the list for patients
        const contactsWithAI = [
          {
            uid: 'ai-assistant',
            firstName: 'AI Medical',
            lastName: 'Assistant',
            photoUrl: null,
            userType: 'ai',
            isAI: true
          }
        ];

        if (!assignSnap.empty) {
          const doctorId = assignSnap.docs[0].data().doctorId;
          const docSnap = await getDoc(doc(db, "users", doctorId));
          if (docSnap.exists()) {
            const d = docSnap.data();
            contactsWithAI.push({
              uid: doctorId,
              firstName: d.firstName || '',
              lastName: d.lastName || '',
              photoUrl: d.photoUrl || null,
              userType: d.userType
            });
          }
        }
        
        setContacts(contactsWithAI);
      }
    } catch (err) {
      console.error("Error fetching contact list:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUid, myUserType]);

  // Refresh contacts when screen is focused
  useEffect(() => {
    if (isFocused && myUserType) {
      fetchContacts();
    }
  }, [isFocused, fetchContacts]);

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
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  if (contacts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No Chat Contacts</Text>
        <Text style={styles.emptySubtitle}>
          {myUserType === "doctor" 
            ? "You don't have any assigned patients yet. Assign patients to start chatting."
            : "You don't have an assigned doctor yet. Contact your healthcare provider."
          }
        </Text>
      </View>
    );
  }

  const renderContactItem = ({ item }) => {
    const fullName = item.isAI 
      ? `${item.firstName} ${item.lastName}` 
      : `${item.firstName} ${item.lastName}`.trim() || 'Unknown User';
    
    const roleLabel = item.isAI 
      ? '🤖' 
      : item.userType === 'doctor' ? 'Dr.' : '';
    
    return (
      <TouchableOpacity
        style={styles.contactRow}
        onPress={() => {
          if (item.isAI) {
            router.push('/AIChatScreen');
          } else {
            router.push(`/chat/${item.uid}`);
          }
        }}
      >
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[
            styles.avatarPlaceholder, 
            styles.avatar, 
            item.isAI && { backgroundColor: '#FF9800' }
          ]}>
            <Text style={styles.initials}>
              {item.isAI ? '🤖' : 
                fullName
                  .split(" ")
                  .map((w) => w.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "?"
              }
            </Text>
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={styles.nameText}>
            {roleLabel} {fullName}
          </Text>
          <Text style={styles.roleText}>
            {item.isAI ? 'AI Medical Assistant' : 
             item.userType === 'doctor' ? 'Your Doctor' : 'Patient'}
          </Text>
        </View>
        <View style={styles.chatIndicator}>
          <Text style={styles.chatIcon}>
            {item.isAI ? '🤖' : '💬'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {myUserType === "doctor" ? "Your Patients & AI Assistant" : "Your Healthcare Team & AI Assistant"}
        </Text>
      </View>
      
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.uid}
        renderItem={renderContactItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f5f5" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666"
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0"
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333"
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4
  },
  listContainer: {
    paddingVertical: 8
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff"
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  contactInfo: {
    flex: 1
  },
  nameText: { 
    fontSize: 16, 
    fontWeight: "600",
    color: "#333",
    marginBottom: 2
  },
  roleText: {
    fontSize: 14,
    color: "#666"
  },
  chatIndicator: {
    marginLeft: 8
  },
  chatIcon: {
    fontSize: 20
  },
  separator: { 
    height: 1, 
    backgroundColor: "#e0e0e0", 
    marginLeft: 78 
  },
});
