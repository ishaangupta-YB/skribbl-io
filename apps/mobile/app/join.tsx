import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { LogIn } from "lucide-react-native";
import { GAME, nicknameSchema, roomIdSchema } from "@skribbl/shared";
import { useTheme } from "@/theme";
import { getRoom, ApiError } from "@/lib/api";
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
  const [joining, setJoining] = useState(false);

  const onJoin = async () => {
    if (joining) return;
    if (!nicknameSchema.safeParse(nickname).success) {
      setError("Enter a nickname (1–16 characters).");
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!roomIdSchema.safeParse(normalized).success) {
      setError(`Room codes are ${GAME.MIN_ROOM_ID_LEN}–${GAME.MAX_ROOM_ID_LEN} characters.`);
      return;
    }
    setJoining(true);
    setError(undefined);
    try {
      const { exists } = await getRoom(normalized);
      if (!exists) {
        setError("No room with that code. Ask the host for the current code.");
        setJoining(false);
        return;
      }
      router.replace({ pathname: "/room/[id]", params: { id: normalized } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not reach the server. Is the backend running?";
      setError(msg);
      setJoining(false);
    }
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
            testID="join-nickname"
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
            testID="join-room-code"
          />
        </Card>

        <Button
          size="lg"
          label={joining ? "Joining…" : "Join room"}
          disabled={joining}
          testID="join-room-button"
          leftIcon={<LogIn size={20} color={colors.primaryForeground} />}
          onPress={onJoin}
        />
      </View>
    </Screen>
  );
}
