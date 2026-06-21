import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { LogIn } from "lucide-react-native";
import { GAME, nicknameSchema, roomIdSchema } from "@skribbl/shared";
import { useTheme } from "@/theme";
import { useIdentity } from "@/lib/store";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Input,
  Screen,
  Text,
} from "@/components";

export default function JoinScreen() {
  const { colors } = useTheme();
  const nickname = useIdentity((s) => s.nickname);
  const setNickname = useIdentity((s) => s.setNickname);
  const avatar = useIdentity((s) => s.avatar);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  const onJoin = () => {
    if (!nicknameSchema.safeParse(nickname).success) {
      setError("Enter a nickname (1–16 characters).");
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!roomIdSchema.safeParse(normalized).success) {
      setError(`Room codes are ${GAME.MIN_ROOM_ID_LEN}–${GAME.MAX_ROOM_ID_LEN} characters.`);
      return;
    }
    setError(undefined);
    router.push({ pathname: "/lobby/[id]", params: { id: normalized } });
  };

  return (
    <Screen scroll>
      <AppHeader title="Join a room" />

      <View className="gap-5 pt-2">
        <View className="items-center gap-3 py-2">
          <Avatar avatar={avatar} size="xl" />
          <Text variant="caption">Joining as {nickname}</Text>
        </View>

        <Card className="gap-4">
          <Input
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            maxLength={GAME.MAX_NICKNAME_LEN}
            placeholder="Your name"
            autoCapitalize="words"
          />
          <Input
            label="Room code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            maxLength={GAME.MAX_ROOM_ID_LEN}
            placeholder="e.g. AB3K90"
            autoCapitalize="characters"
            autoCorrect={false}
            error={error}
            returnKeyType="go"
            onSubmitEditing={onJoin}
          />
        </Card>

        <Button
          size="lg"
          label="Join room"
          leftIcon={<LogIn size={20} color={colors.primaryForeground} />}
          onPress={onJoin}
        />
      </View>
    </Screen>
  );
}
