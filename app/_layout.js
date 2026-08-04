import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { Provider } from "react-redux";
import { store } from "../store/store";
import "./global.css";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="(surveyor)" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </Provider>
  );
}
