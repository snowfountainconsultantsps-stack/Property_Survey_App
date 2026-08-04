import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

export default function SurveySkeleton() {
  const [shimmerAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnimation]);

  const skeletonOpacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonLine = ({ width = "100%", height = 12, marginBottom = 8 }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          marginBottom,
          backgroundColor: "#e5e7eb",
          borderRadius: 6,
        },
        { opacity: skeletonOpacity },
      ]}
    />
  );

  return (
    <View className="flex-1">
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          className="bg-white rounded-xl p-4 mb-3 border-l-4 border-l-survey-dark shadow-md"
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1 pr-3">
              <SkeletonLine width="80%" height={16} marginBottom={8} />
              <SkeletonLine width="60%" height={12} marginBottom={0} />
            </View>
            <SkeletonLine width={60} height={24} marginBottom={0} />
          </View>

          <View className="mb-3">
            <SkeletonLine width="90%" height={12} marginBottom={6} />
            <SkeletonLine width="70%" height={12} marginBottom={0} />
          </View>

          <View className="flex-row justify-between">
            <SkeletonLine width="40%" height={12} marginBottom={0} />
            <SkeletonLine width="30%" height={12} marginBottom={0} />
          </View>
        </View>
      ))}
    </View>
  );
}
