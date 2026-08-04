import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import PublicRoute from "../components/PublicRoute";

function Redirector() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#0f2d5c" />
    </View>
  );
}

// PublicRoute sends an already-logged-in surveyor straight to /(surveyor)/home;
// otherwise this just forwards to /login.
export default function Index() {
  return (
    <PublicRoute>
      <Redirector />
    </PublicRoute>
  );
}
