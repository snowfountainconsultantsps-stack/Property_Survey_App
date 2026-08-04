import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useLogoutMutation } from "../../services/authApi";
import { clearAuth } from "../../store/authSlice";

function Row({ icon, label, value }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
      <MaterialIcons name={icon} size={20} color="#0f2d5c" style={{ marginRight: 12 }} />
      <View>
        <Text style={{ fontSize: 11, color: "#9ca3af" }}>{label}</Text>
        <Text style={{ fontSize: 14, color: "#1f2937", fontWeight: "600" }}>{value || "—"}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state) => state.auth.user);
  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      /* proceed with local logout regardless */
    }
    dispatch(clearAuth());
    Toast.show({ type: "success", text1: "Logged out" });
    router.replace("/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 16 }}>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#0f2d5c", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <MaterialIcons name="person" size={36} color="#fff" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>{user?.full_name || "Surveyor"}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{user?.role}</Text>
      </View>

      <View style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, marginBottom: 20 }}>
        <Row icon="phone" label="Mobile Number" value={user?.phone} />
        <Row icon="badge" label="Role" value={user?.role} />
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        style={{ backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
      >
        <MaterialIcons name="logout" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "700" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
