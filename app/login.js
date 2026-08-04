import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import PublicRoute from "../components/PublicRoute";
import { useLoginMutation } from "../services/authApi";
import { clearAuth, setUser } from "../store/authSlice";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ mobile: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const [login, { isLoading }] = useLoginMutation();

  const handleMobileChange = (value) => {
    const numericValue = value.replace(/[^0-9]/g, "").slice(0, 10);
    setMobileNumber(numericValue);
    if (numericValue) setErrors((e) => ({ ...e, mobile: "" }));
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (value) setErrors((e) => ({ ...e, password: "" }));
  };

  const validateForm = () => {
    const newErrors = { mobile: "", password: "" };
    let isValid = true;

    if (!mobileNumber) {
      newErrors.mobile = "Mobile number is required";
      isValid = false;
    } else if (mobileNumber.length !== 10) {
      newErrors.mobile = "Mobile number must be 10 digits";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      const result = await login({ phone: mobileNumber, password }).unwrap();
      const userRole = result.data?.user?.role;

      if (userRole !== "SURVEYOR") {
        Toast.show({
          type: "error",
          text1: "Unauthorized",
          text2: "This app is for surveyors only.",
        });
        dispatch(clearAuth());
        return;
      }

      dispatch(setUser({ user: result.data.user, token: result.data.token }));
      Toast.show({ type: "success", text1: "Login Successful", text2: "Welcome back!", duration: 2000 });
      router.replace("/(surveyor)/home");
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Login Failed",
        text2: err?.data?.message || "Invalid credentials",
      });
    }
  };

  return (
    <PublicRoute>
      <View className="flex-1 bg-survey-dark">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View className="flex-1 px-5 py-10 justify-center items-center">
              <View
                className="bg-white rounded-2xl p-8 w-full"
                style={{
                  maxWidth: 380,
                  elevation: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                }}
              >
                <View className="items-center mb-4">
                  <View className="w-20 h-20 rounded-full bg-survey-dark items-center justify-center">
                    <MaterialIcons name="assignment" size={40} color="#fff" />
                  </View>
                </View>
                <Text className="text-3xl font-extrabold text-survey-dark mb-2 text-center">
                  Surveyor Login
                </Text>
                <Text className="text-xs text-survey-gray text-center mb-7">
                  Sign in to survey field assets
                </Text>

                <Text className="text-sm font-bold text-survey-title mb-2.5">Mobile Number</Text>
                <TextInput
                  className="bg-gray-50"
                  style={[
                    {
                      borderWidth: 2,
                      borderColor: "#e5e7eb",
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 15,
                      color: "#1f2937",
                      marginBottom: 18,
                      fontWeight: "500",
                    },
                    errors.mobile && { borderColor: "#dc2626" },
                  ]}
                  placeholder="Enter your 10-digit mobile number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobileNumber}
                  onChangeText={handleMobileChange}
                />
                {errors.mobile ? (
                  <Text className="text-red-600 text-xs font-semibold -mt-3.5 mb-3 ml-1">{errors.mobile}</Text>
                ) : null}

                <Text className="text-sm font-bold text-survey-title mb-2.5">Password</Text>
                <View style={{ position: "relative", marginBottom: 18 }}>
                  <TextInput
                    className="bg-gray-50"
                    style={[
                      {
                        borderWidth: 2,
                        borderColor: "#e5e7eb",
                        borderRadius: 10,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 15,
                        color: "#1f2937",
                        fontWeight: "500",
                        paddingRight: 50,
                      },
                      errors.password && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={handlePasswordChange}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    style={{ position: "absolute", right: 12, top: "50%", transform: [{ translateY: -11 }] }}
                  >
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text className="text-red-600 text-xs font-semibold -mt-3.5 mb-3 ml-1">{errors.password}</Text>
                ) : null}

                <TouchableOpacity
                  className="bg-survey-dark py-4 rounded-xl items-center justify-center mt-3"
                  style={{
                    elevation: 8,
                    shadowColor: "#0f2d5c",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                  }}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-base font-extrabold" style={{ letterSpacing: 0.6 }}>
                      Login
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </PublicRoute>
  );
}
