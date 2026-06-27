import { useEffect } from "react";
import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Globe, LogIn, Plus, Settings as SettingsIcon } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { useIdentity } from "@/lib/store";
import {
  Avatar,
  Brand,
  Button,
  Card,
  IconButton,
  Screen,
  Text,
} from "@/components";

function CharacterMark() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: -16,
          right: -8,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "#F5D547",
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const nickname = useIdentity((s) => s.nickname);
  const avatar = useIdentity((s) => s.avatar);

  return (
    <Screen scroll>
      <View className="h-12 flex-row items-center justify-end">
        <IconButton
          variant="secondary"
          onPress={() => router.push("/settings")}
          accessibilityLabel="Open settings"
          testID="home-open-settings"
        >
          <SettingsIcon size={20} color={colors.foreground} />
        </IconButton>
      </View>

      <View className="flex-1 justify-center gap-8 py-6">
        <View className="items-center gap-3">
          <View className="relative">
            <CharacterMark />
            <Brand size="lg" />
          </View>
          <Text className="text-center text-base text-muted-foreground">
            Draw, guess, and out-sketch your friends in real time.
          </Text>
        </View>

        <Card className="flex-row items-center gap-4">
          <Avatar avatar={avatar} size="lg" />
          <View className="flex-1">
            <Text variant="caption">Playing as</Text>
            <Text variant="subtitle" numberOfLines={1}>
              {nickname}
            </Text>
          </View>
          <Button
            variant="secondary"
            size="sm"
            label="Edit"
            testID="home-edit-profile"
            onPress={() => router.push("/settings")}
          />
        </Card>

        <View className="gap-3">
          <Button
            size="lg"
            label="Create room"
            testID="home-create-room"
            leftIcon={<Plus size={20} color={colors.primaryForeground} />}
            onPress={() => router.push("/create")}
          />
          <Button
            size="lg"
            variant="secondary"
            label="Join with a code"
            testID="home-join-code"
            leftIcon={<LogIn size={20} color={colors.secondaryForeground} />}
            onPress={() => router.push("/join")}
          />
          <Button
            size="lg"
            variant="outline"
            label="Browse public rooms"
            testID="home-browse-rooms"
            leftIcon={<Globe size={20} color={colors.foreground} />}
            onPress={() => router.push("/lobby")}
          />
        </View>
      </View>

      <View className="items-center gap-1 pb-2">
        <Text className="text-xs text-muted-foreground font-mono">Draw • Guess • Win</Text>
        <Pressable onPress={() => Linking.openURL("https://ishaangupta.tech")}>
          <Text className="text-xs text-muted-foreground">
            Made by <Text className="text-xs font-semibold text-accent">Ishaan Gupta</Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
