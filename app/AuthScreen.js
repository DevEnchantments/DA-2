// app/AuthScreen.js
import { db, auth } from "../configs/firebaseConfig"; // Corrected path
import { setDoc, doc } from "firebase/firestore";
import React, { useState } from "react";
import { View, TextInput, Button, Text, StyleSheet, Alert } from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import useGoogleAuth from "../auth/GoogleAuth"; // Corrected path
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";

const AuthScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(new Date());
  const [gender, setGender] = useState("Male");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();

  const { promptAsync, request } = useGoogleAuth();

  const calculateAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleAuth = async () => {
    setError("");
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email,
          firstName,
          lastName,
          gender,
          dateOfBirth: dob.toISOString(),
          age: calculateAge(dob),
          bio: "Hi there! I\'m new here.",
          // photoUrl: null, // Initialize photoUrl if desired
        });
        Alert.alert("Success", "Account created! Please log in.");
        setIsSignUp(false); // Switch to login form
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // Navigation will be handled by app/index.js or root layout based on auth state
        // router.replace("/(Tabs)/HomeScreen"); // Or let index.js handle it
      }
    } catch (err) {
      // Error handling remains the same
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use. Try logging in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email format.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 8 characters.");
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password. Try again or sign up.");
      } else {
        console.error("Auth error:", err);
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  // Rest of your AuthScreen component (JSX and styles) remains the same...
  // Make sure to include the full component code here when you save it.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isSignUp ? "Sign Up" : "Log In"}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isSignUp && (
        <>
          <TextInput placeholder="First Name" placeholderTextColor="gray" value={firstName} onChangeText={setFirstName} style={styles.input} />
          <TextInput placeholder="Last Name" placeholderTextColor="gray" value={lastName} onChangeText={setLastName} style={styles.input} />
          <Text style={styles.label}>Date of Birth</Text>
          <Button title={dob.toDateString()} onPress={() => setShowDatePicker(true)} />
          {showDatePicker && (
            <DateTimePicker value={dob} mode="date" display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDob(selectedDate);
              }}
            />
          )}
          <Text style={styles.label}>Gender</Text>
          <Picker selectedValue={gender} onValueChange={(itemValue) => setGender(itemValue)} style={styles.picker} itemStyle={styles.pickerItem}>
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </>
      )}
      <TextInput placeholder="Email" placeholderTextColor="gray" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="Password" placeholderTextColor="gray" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button title={isSignUp ? "Sign Up" : "Log In"} onPress={handleAuth} />
      <View style={{ marginVertical: 10 }} />
      <Button title="Sign in with Google" disabled={!request} onPress={() => promptAsync()} />
      <Text style={styles.toggleText} onPress={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? "Already have an account? Log In" : "Don\'t have an account? Sign Up"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: { width: "100%", padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 10, color: "black" }, // Ensure text color is visible
  label: { alignSelf: "flex-start", marginTop: 10, fontWeight: "bold", color: "black" },
  picker: { width: "100%", marginBottom: 10, color: "black" }, // Ensure text color is visible
  pickerItem: { color: "black", fontSize: 16 }, // Ensure text color is visible
  error: { color: "red", fontWeight: "bold", fontSize: 16, marginBottom: 10, textAlign: "center" },
  toggleText: { marginTop: 20, color: "blue" },
});

export default AuthScreen;