import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { GAME, listWordPacks, nicknameSchema } from "@skribbl/shared";
import { useTheme } from "@/theme";
import { createRoom, ApiError } from "@/lib/api";
import { useIdentity, useRoomDraft } from "@/lib/store";
import {
  AppHeader,
  AvatarPicker,
  Avatar,
  Button,
  Card,
  Chip,
  Screen,
  Sheet,
  Stepper,
  SwitchRow,
  Text,
  Input,
  useToast,
} from "@/components";

const WORD_PACKS = listWordPacks();

export default function CreateScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const nickname = useIdentity((s) => s.nickname);
  const setNickname = useIdentity((s) => s.setNickname);
  const avatar = useIdentity((s) => s.avatar);
  const setAvatar = useIdentity((s) => s.setAvatar);
  const settings = useRoomDraft((s) => s.settings);
  const setSettings = useRoomDraft((s) => s.setSettings);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const togglePack = (id: string) => {
    const has = settings.wordPackIds.includes(id);
    const next = has
      ? settings.wordPackIds.filter((p) => p !== id)
      : [...settings.wordPackIds, id];
    if (next.length === 0) return; // at least one pack required
    setSettings({ wordPackIds: next });
  };

  const onCreate = async () => {
    if (!nicknameSchema.safeParse(nickname).success) {
      toast.error("Pick a nickname", "1–16 characters.");
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const { roomId } = await createRoom(settings);
      router.replace({ pathname: "/room/[id]", params: { id: roomId, host: "1" } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create the room. Is the backend running?";
      toast.error("Create failed", msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen scroll>
      <AppHeader title="Create room" />

      <View className="gap-5 pt-2">
        <Card className="flex-row items-center gap-4">
          <Avatar avatar={avatar} size="lg" />
          <View className="flex-1">
            <Input
              label="Nickname"
              value={nickname}
              onChangeText={setNickname}
              maxLength={GAME.MAX_NICKNAME_LEN}
              placeholder="Your name"
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
          <Button variant="secondary" size="sm" label="Avatar" onPress={() => setAvatarOpen(true)} />
        </Card>

        <Card className="gap-5">
          <Text variant="subtitle">Game settings</Text>

          <Stepper
            label="Rounds"
            value={settings.maxRounds}
            min={GAME.MIN_ROUNDS}
            max={GAME.MAX_ROUNDS}
            onChange={(maxRounds) => setSettings({ maxRounds })}
          />
          <Stepper
            label="Draw time"
            value={settings.roundDurationSec}
            min={GAME.MIN_ROUND_DURATION_SEC}
            max={GAME.MAX_ROUND_DURATION_SEC}
            step={10}
            format={(v) => `${v}s`}
            onChange={(roundDurationSec) => setSettings({ roundDurationSec })}
          />
          <Stepper
            label="Max players"
            value={settings.maxPlayers}
            min={GAME.MIN_PLAYERS_TO_START}
            max={GAME.MAX_PLAYERS}
            onChange={(maxPlayers) => setSettings({ maxPlayers })}
          />
        </Card>

        <Card className="gap-3">
          <Text variant="subtitle">Word packs</Text>
          <View className="flex-row flex-wrap gap-2">
            {WORD_PACKS.map((pack) => (
              <Chip
                key={pack.id}
                label={pack.name}
                selected={settings.wordPackIds.includes(pack.id)}
                onPress={() => togglePack(pack.id)}
              />
            ))}
          </View>
        </Card>

        <Card className="gap-4">
          <SwitchRow
            label="Hints"
            description="Reveal letters as the timer runs down."
            value={settings.hintsEnabled}
            onValueChange={(hintsEnabled) => setSettings({ hintsEnabled })}
          />
          <SwitchRow
            label="Public lobby"
            description="List this room in the public browser."
            value={settings.isPublic}
            onValueChange={(isPublic) => setSettings({ isPublic })}
          />
        </Card>

        <Button
          size="lg"
          label={creating ? "Creating…" : "Create room"}
          disabled={creating}
          leftIcon={<Sparkles size={20} color={colors.primaryForeground} />}
          onPress={onCreate}
        />
      </View>

      <Sheet visible={avatarOpen} onClose={() => setAvatarOpen(false)} title="Choose your avatar">
        <AvatarPicker avatar={avatar} onChange={setAvatar} />
        <Button className="mt-5" label="Done" onPress={() => setAvatarOpen(false)} />
      </Sheet>
    </Screen>
  );
}
