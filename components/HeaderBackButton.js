import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { TouchableOpacity } from "react-native";

// Detail screens live inside the tab navigator (registered with href:null),
// and a tab navigator renders no back affordance of its own — so pushed
// screens need this in their header or the surveyor gets stuck there.
export default function HeaderBackButton({ fallback = "/(surveyor)/home" }) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };

  return (
    <TouchableOpacity
      onPress={goBack}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <MaterialIcons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
  );
}
