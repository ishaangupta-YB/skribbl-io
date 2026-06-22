import { View } from "react-native";
import { router } from "expo-router";
import { Globe, LogIn, Plus, Settings as SettingsIcon } from "lucide-react-native";
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
        >
          <SettingsIcon size={20} color={colors.foreground} />
        </IconButton>
      </View>

      <View className="flex-1 justify-center gap-8 py-6">
        <View className="items-center gap-3">
          <Brand size="lg" />
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
            onPress={() => router.push("/settings")}
          />
        </Card>

        <View className="gap-3">
          <Button
            size="lg"
            label="Create room"
            leftIcon={<Plus size={20} color={colors.primaryForeground} />}
            onPress={() => router.push("/create")}
          />
          <Button
            size="lg"
            variant="secondary"
            label="Join with a code"
            leftIcon={<LogIn size={20} color={colors.secondaryForeground} />}
            onPress={() => router.push("/join")}
          />
          <Button
            size="lg"
            variant="outline"
            label="Browse public rooms"
            leftIcon={<Globe size={20} color={colors.foreground} />}
            onPress={() => router.push("/lobby")}
          />
        </View>
      </View>

      <View className="items-center pb-2">
        <Text className="text-xs text-muted-foreground">Draw • Guess • Win</Text>
      </View>
    </Screen>
  );
}
