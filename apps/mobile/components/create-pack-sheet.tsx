import { useState } from "react";
import { View } from "react-native";
import { createWordPack, ApiError } from "@/lib/api";
import type { WordPackDetail } from "@/lib/api";
import { parseCustomWords } from "@/lib/utils";
import { Button, Input, Sheet, SwitchRow, Text, TextArea } from "./ui";

interface CreatePackSheetProps {
  visible: boolean;
  onClose: () => void;
  nickname: string;
  onCreated: (pack: WordPackDetail) => void;
}

const MAX_PACK_NAME_LEN = 50;
const MAX_PACK_DESCRIPTION_LEN = 200;
const MAX_WORDS_PER_PACK = 100;

export function CreatePackSheet({ visible, onClose, nickname, onCreated }: CreatePackSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setWordsText("");
    setIsPublic(true);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSave = async () => {
    if (saving) return;
    setError(null);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const parsed = parseCustomWords(wordsText);

    if (trimmedName.length === 0) {
      setError("Pack name is required.");
      return;
    }
    if (parsed.length === 0) {
      setError("At least one word is required.");
      return;
    }
    if (parsed.length > MAX_WORDS_PER_PACK) {
      setError(`At most ${MAX_WORDS_PER_PACK} words allowed per pack.`);
      return;
    }

    setSaving(true);
    try {
      const res = await createWordPack({
        name: trimmedName,
        description: trimmedDescription,
        words: parsed,
        isPublic,
        createdBy: nickname,
      });
      reset();
      onClose();
      onCreated(res.pack);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create the pack.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={handleClose} title="Create word pack">
      <View className="gap-4">
        <Input
          label="Pack name"
          value={name}
          onChangeText={setName}
          maxLength={MAX_PACK_NAME_LEN}
          placeholder="My awesome pack"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={MAX_PACK_DESCRIPTION_LEN}
          placeholder="A short description"
        />
        <TextArea
          label="Words"
          hint={`Separate words with commas or newlines. Max ${MAX_WORDS_PER_PACK} words, 30 characters each.`}
          value={wordsText}
          onChangeText={setWordsText}
          placeholder="e.g. cat, dog, elephant…"
        />
        <SwitchRow
          label="Public"
          description="Other players can use this pack too."
          value={isPublic}
          onValueChange={setIsPublic}
        />
        {error ? <Text className="text-xs text-danger">{error}</Text> : null}
        <Button label={saving ? "Saving…" : "Save pack"} disabled={saving} onPress={onSave} />
      </View>
    </Sheet>
  );
}
