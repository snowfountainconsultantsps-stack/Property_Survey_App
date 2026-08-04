import { Stack } from "expo-router";

export default function SurveysLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
