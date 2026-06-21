import { View } from "react-native";
import Constants from "expo-constants";
import { GAME } from "@skribbl/shared";
import { WS_BASE_URL } from "@/lib/config";
import { useIdentity, type ThemePreference } from "@/lib/store";
import {
  AppHeader,
  AvatarPicker,
  Card,
  Chip,
  Input,
  Screen,
  SwitchRow,
  Text,
} from "@/components";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function SettingsScreen() {
  const nickname = useIdentity((s) => s.nickname);
  const setNickname = useIdentity((s) => s.setNickname);
  const avatar = useIdentity((s) => s.avatar);
  const setAvatar = useIdentity((s) => s.setAvatar);
  const settings = useIdentity((s) => s.settings);
  const updateSettings = useIdentity((s) => s.updateSettings);

  return (
    <Screen scroll>
      <AppHeader title="Settings" />

      <View className="gap-5 pt-2">
        <Card>
          <Input
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            maxLength={GAME.MAX_NICKNAME_LEN}
            placeholder="Your name"
            autoCapitalize="words"
          />
        </Card>

        <Card>
          <AvatarPicker avatar={avatar} onChange={setAvatar} />
        </Card>

        <Card className="gap-4">
          <View className="gap-2">
            <Text variant="label">Theme</Text>
            <View className="flex-row gap-2">
              {THEME_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={settings.theme === option.value}
                  onPress={() => updateSettings({ theme: option.value })}
                />
              ))}
            </View>
          </View>

          <SwitchRow
            label="Sound effects"
            description="Play sounds for guesses, turns, and wins."
            value={settings.sound}
            onValueChange={(sound) => updateSettings({ sound })}
          />
          <SwitchRow
            label="Haptics"
            description="Vibration feedback on touch (mobile)."
            value={settings.haptics}
            onValueChange={(haptics) => updateSettings({ haptics })}
          />
        </Card>

        <View className="items-center gap-1 pb-4 pt-2">
          <Text className="text-xs text-muted-foreground">
            Skribbl Cloud v{Constants.expoConfig?.version ?? "0.1.0"}
          </Text>
          <Text className="text-xs text-muted-foreground">Server: {WS_BASE_URL}</Text>
        </View>
      </View>
    </Screen>
  );
}
