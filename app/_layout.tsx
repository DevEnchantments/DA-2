// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { auth, db } from "../configs/firebaseConfig";

// NEW: Auth Context for role checking
interface AuthContextType {
  user: any;
  userLoggedIn: boolean;
  userType: string | null;
  userData: any;
  isDoctor: boolean;
  isPatient: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userLoggedIn: false,
  userType: null,
  userData: null,
  isDoctor: false,
  isPatient: false,
  loading: true,
});

// NEW: Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const [loading, setLoading] = useState(true);
    const [userLoggedIn, setUserLoggedIn] = useState(false);
    
    // NEW: Enhanced auth state with role checking
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const [userType, setUserType] = useState<string | null>(null);

    // NEW: Helper functions for role checking
    const isDoctor = userType === 'doctor';
    const isPatient = userType === 'patient';

    useEffect(() => {
      console.log("RootLayout: Subscribing to onAuthStateChanged");
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log("RootLayout: onAuthStateChanged fired. User:", firebaseUser ? firebaseUser.uid : null);
        
        setUser(firebaseUser);
        setUserLoggedIn(!!firebaseUser);

        if (firebaseUser) {
          try {
            // NEW: Fetch user data including role information
            console.log("RootLayout: Fetching user data for role checking...");
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const fetchedUserData = userDoc.data();
              setUserData(fetchedUserData);
              setUserType(fetchedUserData?.userType || null);
              
              console.log("RootLayout: User data loaded:", {
                uid: firebaseUser.uid,
                userType: fetchedUserData?.userType,
                isDoctor: fetchedUserData?.userType === 'doctor',
                isPatient: fetchedUserData?.userType === 'patient'
              });
            } else {
              console.warn("RootLayout: User document not found in Firestore");
              setUserData(null);
              setUserType(null);
            }
          } catch (error) {
            console.error("RootLayout: Error fetching user data:", error);
            setUserData(null);
            setUserType(null);
          }
        } else {
          // User logged out
          setUserData(null);
          setUserType(null);
        }
        
        setLoading(false);
      });
      
      return () => {
        console.log("RootLayout: Unsubscribing from onAuthStateChanged");
        unsubscribe();
      };
    }, []);

    useEffect(() => {
        if (loading) return; // Don't navigate until auth state is determined
    
        const currentTopLevelRoute = segments.length > 0 ? segments[0] : null;
        console.log("RootLayout: Checking navigation. UserLoggedIn:", userLoggedIn, "Current Top Level Route:", currentTopLevelRoute, "Full Segments:", segments);
        console.log("RootLayout: User role info - Type:", userType, "IsDoctor:", isDoctor, "IsPatient:", isPatient);
    
        if (userLoggedIn) {
          // User IS logged in.
          // Allow navigation to all authenticated routes including meal logging features
          if (currentTopLevelRoute !== "(Tabs)" && 
              currentTopLevelRoute !== "BookmarksScreen" && 
              currentTopLevelRoute !== "CategoryScreen" && 
              currentTopLevelRoute !== "RecipeDetailScreen" && 
              currentTopLevelRoute !== "RecipesScreen" &&
              currentTopLevelRoute !== "MealPlanScreen" &&
              currentTopLevelRoute !== "MealPlanPreferencesScreen" &&
              currentTopLevelRoute !== "PatientManagementScreen" &&
              currentTopLevelRoute !== "ManualMealPlanScreen" &&
              currentTopLevelRoute !== "AIChatScreen" &&
              currentTopLevelRoute !== "ShoppingListScreen" &&
              currentTopLevelRoute !== "MealLoggingScreen" &&
              currentTopLevelRoute !== "mealHistoryScreen") {

            console.log("RootLayout: User is logged in. Current top route is not allowed (it is '" + currentTopLevelRoute + "'). Navigating to /(Tabs)/HomeScreen.");
            router.replace("/(Tabs)/HomeScreen");
          }
        } else {
          // User is NOT logged in.
          if (currentTopLevelRoute !== "AuthScreen") {
            console.log("RootLayout: User is NOT logged in. Current top route is not 'AuthScreen' (it is '" + currentTopLevelRoute + "'). Navigating to /AuthScreen.");
            router.replace("/AuthScreen");
          }
        }
      }, [userLoggedIn, segments, router, loading, userType]);
    
    if (loading) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      );
    }

    // NEW: Provide auth context to entire app
    const authContextValue: AuthContextType = {
      user,
      userLoggedIn,
      userType,
      userData,
      isDoctor,
      isPatient,
      loading,
    };

    return (
      <AuthContext.Provider value={authContextValue}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthScreen" />
          <Stack.Screen name="(Tabs)" />
          <Stack.Screen name="BookmarksScreen" />
          <Stack.Screen name="CategoryScreen" />
          <Stack.Screen name="RecipeDetailScreen" />
          <Stack.Screen name="RecipesScreen" />
          <Stack.Screen name="MealPlanScreen" />
          <Stack.Screen name="MealPlanPreferencesScreen" />
          <Stack.Screen name="PatientManagementScreen" />
          <Stack.Screen name="ManualMealPlanScreen" />
          <Stack.Screen name="AIChatScreen" />
          <Stack.Screen name="ShoppingListScreen" />
          <Stack.Screen name="MealLoggingScreen" />
          <Stack.Screen name="mealHistoryScreen" />
        </Stack>

      </AuthContext.Provider>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });