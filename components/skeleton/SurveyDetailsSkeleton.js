import { useEffect, useState } from "react";
import { Animated, View } from "react-native";


export default function SurveyDetailsSkeleton() {
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
 
  return (
    <View style={{ flex: 1, padding: 16 }}>
        <Animated.View
          style={[
            {
              width: "100%",
              height: 200,
                marginBottom: 16,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        <Animated.View
          style={[
            {
              width: "100%",
              height: 12,
              marginBottom: 8,
              backgroundColor: "#e5e7eb",
              borderRadius: 6,
            },
            { opacity: skeletonOpacity },
          ]}
        />
        
    </View>
    );
}
