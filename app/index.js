// app/index.js
import { Redirect } from "expo-router";

export default function Index() {
  // The RootLayout (app/_layout.tsx) will handle auth checks and redirects.
  // This index can just redirect to a known starting point within the stack if needed,
  // but often the RootLayout handles the initial view.
  // If RootLayout shows a loading indicator, this might not even be seen.
  // For simplicity, let's assume RootLayout handles everything.
  // Or, you could redirect to a specific initial screen if your RootLayout doesn't have an initial route.
  // return <Redirect href="/AuthScreen" />; // Or let RootLayout decide
  return null; // RootLayout will render based on its logic
}
