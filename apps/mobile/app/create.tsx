import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Plus, Sparkles } from "lucide-react-native";
import { GAME, listWordPacks as listBundledPacks, nicknameSchema } from "@skribbl/shared";
import { useTheme } from "@/theme";
import { createRoom, listWordPacks, ApiError } from "@/lib/api";
import type { WordPackDetail } from "@/lib/api";
import { useIdentity, useRoomDraft } from "@/lib/store";
import { formatCustomWords, parseCustomWords } from "@/lib/utils";
import {
  AppHeader,
  AvatarPicker,
  Avatar,
  Button,
  Card,
  Chip,
  CreatePackSheet,
  Screen,
  Sheet,
  Stepper,
  SwitchRow,
  Text,
  Input,
  TextArea,
  useToast,
} from "@/components";

const BUNDLED_PACKS = listBundledPacks();

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

  const [packsState, setPacksState] = useState<{ packs: WordPackDetail[]; loading: boolean }>({
    packs: BUNDLED_PACKS as WordPackDetail[],
    loading: true,
  });
  const [packSheetOpen, setPackSheetOpen] = useState(false);
  const { packs, loading: loadingPacks } = packsState;

  useEffect(() => {
    let cancelled = false;
    listWordPacks()
      .then((res) => {
        if (cancelled) return;
        setPacksState((prev) => ({ ...prev, packs: res.packs as WordPackDetail[] }));
      })
      .catch(() => {
        // Bundled packs are always available as a fallback.
      })
      .finally(() => {
        if (!cancelled) setPacksState((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const packById = useMemo(() => {
    const map = new Map<string, WordPackDetail>();
    for (const p of packs) map.set(p.id, p);
    return map;
  }, [packs]);

  const selectedPacks = useMemo(() => {
    return settings.wordPackIds
      .map((id) => packById.get(id))
      .filter((p): p is WordPackDetail => Boolean(p));
  }, [settings.wordPackIds, packById]);

  const togglePack = useCallback(
    (id: string) => {
      const has = settings.wordPackIds.includes(id);
      const next = has ? settings.wordPackIds.filter((p) => p !== id) : [...settings.wordPackIds, id];
      if (next.length === 0) return; // at least one pack required
      setSettings({ wordPackIds: next });
    },
    [settings.wordPackIds, setSettings],
  );

  const customWordsText = useMemo(() => formatCustomWords(settings.customWords ?? []), [settings.customWords]);

  const onCustomWordsChange = useCallback(
    (text: string) => {
      setSettings({ customWords: parseCustomWords(text) });
    },
    [setSettings],
  );

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

  const onPackCreated = useCallback(
    (pack: WordPackDetail) => {
      setPacksState((prev) => ({
        ...prev,
        packs: [...prev.packs.filter((p) => p.id !== pack.id), pack],
      }));
      setSettings({ wordPackIds: [...settings.wordPackIds, pack.id] });
      toast.success("Pack created", `${pack.name} is ready to use.`);
    },
    [settings.wordPackIds, setSettings, toast],
  );

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
          <View className="flex-row items-center justify-between">
            <Text variant="subtitle">Word packs</Text>
            {loadingPacks ? <Text className="text-xs text-muted-foreground">Loading…</Text> : null}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {packs.map((pack) => {
              const selected = settings.wordPackIds.includes(pack.id);
              return (
                <Chip
                  key={pack.id}
                  label={`${pack.name} (${pack.words.length})`}
                  selected={selected}
                  onPress={() => togglePack(pack.id)}
                />
              );
            })}
            <Chip
              label="New pack"
              selected={false}
              onPress={() => setPackSheetOpen(true)}
              leftIcon={<Plus size={14} color={colors.primary} />}
            />
          </View>

          {selectedPacks.length > 0 ? (
            <Text className="text-xs text-muted-foreground">
              {selectedPacks.reduce((sum, p) => sum + p.words.length, 0)} words across {selectedPacks.length} pack
              {selectedPacks.length === 1 ? "" : "s"}
            </Text>
          ) : null}
        </Card>

        <Card className="gap-3">
          <Text variant="subtitle">Extra words</Text>
          <TextArea
            label="Quick custom list"
            hint="Separate words with commas or newlines."
            value={customWordsText}
            onChangeText={onCustomWordsChange}
            placeholder="e.g. dragon, robot, taco"
          />
          {(settings.customWords?.length ?? 0) > 0 ? (
            <Text className="text-xs text-muted-foreground">{settings.customWords.length} custom word(s) added.</Text>
          ) : null}
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

      <CreatePackSheet
        visible={packSheetOpen}
        onClose={() => setPackSheetOpen(false)}
        nickname={nickname}
        onCreated={onPackCreated}
      />
    </Screen>
  );
}
