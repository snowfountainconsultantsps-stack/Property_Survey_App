import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import useAuth from "../hooks/useAuth";

export default function PublicRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/(surveyor)/home");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0f2d5c" />
      </View>
    );
  }

  if (isAuthenticated) return null;

  return children;
}
