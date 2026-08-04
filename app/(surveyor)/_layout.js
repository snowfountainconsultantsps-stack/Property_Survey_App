import { Tabs } from "expo-router";
import ProtectedRoute from "../../components/ProtectedRoute";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import HeaderBackButton from "../../components/HeaderBackButton";

export default function SurveyorLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ProtectedRoute>
      <Tabs
        screenOptions={{
          headerTitleAlign: "center",
          headerShown: true,
          headerStyle: { backgroundColor: "#0f2d5c", height: 100 },
          headerTitleStyle: { fontSize: 20, color: "#fff" },
          headerTintColor: "#fff",
          tabBarStyle: {
            backgroundColor: "#0f2d5c",
            height: 60 + insets.bottom,
            paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#93a5c9",
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Survey",
            tabBarIcon: ({ color }) => <MaterialIcons name="layers" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="my-surveys"
          options={{
            title: "My Surveys",
            tabBarIcon: ({ color }) => <MaterialIcons name="assignment-turned-in" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
          }}
        />
        {/* Reachable via navigation, not shown as tabs. A tab navigator has
            no back affordance of its own, so pushed screens get one here. */}
        <Tabs.Screen
          name="assets/map/[layerId]"
          options={{
            href: null,
            title: "Asset Map",
            headerLeft: () => <HeaderBackButton />,
          }}
        />
        <Tabs.Screen
          name="survey/[id]"
          options={{
            href: null,
            title: "Survey",
            headerLeft: () => <HeaderBackButton />,
          }}
        />
        {/* The property wizard screens render their own header (with a back
            button), so the tab header would just stack a second one on top. */}
        <Tabs.Screen name="property" options={{ href: null, headerShown: false }} />
      </Tabs>
    </ProtectedRoute>
  );
}
