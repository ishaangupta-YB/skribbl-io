import { router, Stack } from "expo-router";
import { View } from "react-native";
import { Button, Screen, Text } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-6xl">🤔</Text>
          <Text variant="title">This page got lost</Text>
          <Text className="text-center text-muted-foreground">
            The screen you were looking for doesn&apos;t exist.
          </Text>
          <Button label="Back to home" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    </>
  );
}
