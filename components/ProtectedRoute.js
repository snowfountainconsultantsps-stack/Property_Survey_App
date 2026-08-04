import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, role } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || role !== "SURVEYOR") {
        setRedirecting(true);
        router.replace("/login");
      } else {
        setRedirecting(false);
      }
    }
  }, [loading, isAuthenticated, role, router]);

  if (loading || redirecting) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0f2d5c" />
      </View>
    );
  }

  return children;
}
