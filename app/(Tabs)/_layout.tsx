// app/(Tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // headerShown: false, // Uncomment if you want to hide headers for all tabs by default
      }}
    >
      <Tabs.Screen
        name="HomeScreen" // This matches app/(Tabs)/HomeScreen.js
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          // headerShown: false, // You can set header visibility per tab
        }}
      />
      <Tabs.Screen
        name="chat" // This matches app/(Tabs)/chat/ folder
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "chatbubbles" : "chatbubbles-outline"} 
              size={size} 
              color={color} 
            />
          ),
          headerShown: false, // Chat screens handle their own headers
        }}
      />
      <Tabs.Screen
        name="ProfileScreen" // This matches app/(Tabs)/ProfileScreen.js
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          // headerShown: false, // You can set header visibility per tab
        }}
      />
      {/* You can add more Tabs.Screen here later for other main app sections */}
    </Tabs>
  );
}
