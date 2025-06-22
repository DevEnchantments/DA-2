// app/(Tabs)/ProfileScreen.js
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { auth, db, storage } from "../../configs/firebaseConfig"; // Corrected path (up two levels)
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "expo-router";

const ProfileScreen = () => {
  // ... (rest of your ProfileScreen_fixed.js logic remains the same)
  // The only change needed here is the import path for firebaseConfig.
  // Make sure to use the full content of ProfileScreen_fixed.js I sent previously.
  const [userData, setUserData] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const router = useRouter();
  // currentUser will be derived from onAuthStateChanged or directly from auth if needed

  const fetchUserData = useCallback(async (user) => {
    if (user) {
      setLoadingUser(true);
      setUserData(null);
      setPhotoUrl(null);
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setPhotoUrl(data.photoUrl || null);
        } else {
          console.log("No user data found for UID:", user.uid);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoadingUser(false);
      }
    } else {
      setUserData(null);
      setPhotoUrl(null);
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      fetchUserData(user);
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  const handleUpload = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to upload an image.");
      return;
    }
    // ... (rest of handleUpload from ProfileScreen_fixed.js)
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission required", "Camera roll permission is required!");
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: false,
      });
      if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
        setUploading(true);
        const uri = pickerResult.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = ref(storage, `profileImages/${currentUser.uid}.jpg`);
        await uploadBytes(imageRef, blob);
        const downloadURL = await getDownloadURL(imageRef);
        setPhotoUrl(downloadURL);
        await updateDoc(doc(db, "users", currentUser.uid), { photoUrl: downloadURL });
        Alert.alert("Success", "Profile picture updated!");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      Alert.alert("Error", "Failed to upload profile picture.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/AuthScreen"); // Or "/" if index.js handles redirect to AuthScreen
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loadingUser) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#000" /><Text>Loading profile...</Text></View>;
  }

  // Ensure you have a default avatar image in your assets folder
  // and the path is correct, e.g., require("../../assets/images/default-avatar.png")
  const avatarSource = photoUrl ? { uri: photoUrl } : require("../../assets/images/default-avatar.png");

  return (
    <View style={styles.container}>
      {uploading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <TouchableOpacity onPress={handleUpload} disabled={!auth.currentUser}>
          <Image source={avatarSource} style={styles.avatar} />
        </TouchableOpacity>
      )}
      {auth.currentUser && userData ? (
        <>
          <Text style={styles.name}>{userData.firstName} {userData.lastName}</Text>
          <Text style={styles.email}>{userData.email}</Text>
          <Text style={styles.detail}>Gender: {userData.gender}</Text>
          <Text style={styles.detail}>Age: {userData.age}</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Log Out</Text></TouchableOpacity>
        </>
      ) : (
        <Text>No user data available. Please log in.</Text>
      )}
    </View>
  );
};

// Make sure styles are defined as in ProfileScreen_fixed.js
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  avatar: { width: 140, height: 140, borderRadius: 70, marginBottom: 20, borderWidth: 2, borderColor: "#aaa", backgroundColor: "#e1e1e1" },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  email: { fontSize: 16, marginBottom: 8 },
  detail: { fontSize: 16, marginVertical: 2 },
  logoutButton: { marginTop: 30, padding: 10, backgroundColor: "#d11a2a", borderRadius: 5 },
  logoutText: { color: "#fff", fontWeight: "bold" },
});

export default ProfileScreen;