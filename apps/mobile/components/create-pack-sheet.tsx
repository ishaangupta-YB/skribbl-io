import { useReducer } from "react";
import { View } from "react-native";
import { createWordPack, ApiError } from "@/lib/api";
import type { WordPackDetail } from "@/lib/api";
import { parseCustomWords } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet } from "./ui/modal";
import { SwitchRow } from "./ui/switch-row";
import { Text } from "./ui/text";
import { TextArea } from "./ui/textarea";

interface CreatePackSheetProps {
  visible: boolean;
  onClose: () => void;
  nickname: string;
  onCreated: (pack: WordPackDetail) => void;
}

const MAX_PACK_NAME_LEN = 50;
const MAX_PACK_DESCRIPTION_LEN = 200;
const MAX_WORDS_PER_PACK = 100;

interface FormState {
  name: string;
  description: string;
  wordsText: string;
  isPublic: boolean;
  saving: boolean;
  error: string | null;
}

const INITIAL_STATE: FormState = {
  name: "",
  description: "",
  wordsText: "",
  isPublic: true,
  saving: false,
  error: null,
};

type FormAction = { type: "patch"; patch: Partial<FormState> } | { type: "reset" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export function CreatePackSheet({ visible, onClose, nickname, onCreated }: CreatePackSheetProps) {
  const [state, dispatch] = useReducer(formReducer, INITIAL_STATE);
  const { name, description, wordsText, isPublic, saving, error } = state;

  const reset = () => dispatch({ type: "reset" });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSave = async () => {
    if (saving) return;
    dispatch({ type: "patch", patch: { error: null } });
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const parsed = parseCustomWords(wordsText);

    if (trimmedName.length === 0) {
      dispatch({ type: "patch", patch: { error: "Pack name is required." } });
      return;
    }
    if (parsed.length === 0) {
      dispatch({ type: "patch", patch: { error: "At least one word is required." } });
      return;
    }
    if (parsed.length > MAX_WORDS_PER_PACK) {
      dispatch({ type: "patch", patch: { error: `At most ${MAX_WORDS_PER_PACK} words allowed per pack.` } });
      return;
    }

    dispatch({ type: "patch", patch: { saving: true } });
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
      dispatch({ type: "patch", patch: { error: msg } });
    } finally {
      dispatch({ type: "patch", patch: { saving: false } });
    }
  };

  return (
    <Sheet visible={visible} onClose={handleClose} title="Create word pack">
      <View className="gap-4">
        <Input
          label="Pack name"
          value={name}
          onChangeText={(text) => dispatch({ type: "patch", patch: { name: text } })}
          maxLength={MAX_PACK_NAME_LEN}
          placeholder="My awesome pack"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={(text) => dispatch({ type: "patch", patch: { description: text } })}
          maxLength={MAX_PACK_DESCRIPTION_LEN}
          placeholder="A short description"
        />
        <TextArea
          label="Words"
          hint={`Separate words with commas or newlines. Max ${MAX_WORDS_PER_PACK} words, 30 characters each.`}
          value={wordsText}
          onChangeText={(text) => dispatch({ type: "patch", patch: { wordsText: text } })}
          placeholder="e.g. cat, dog, elephant…"
        />
        <SwitchRow
          label="Public"
          description="Other players can use this pack too."
          value={isPublic}
          onValueChange={(value) => dispatch({ type: "patch", patch: { isPublic: value } })}
        />
        {error ? <Text className="text-xs text-coral">{error}</Text> : null}
        <Button label={saving ? "Saving…" : "Save pack"} disabled={saving} onPress={onSave} />
      </View>
    </Sheet>
  );
}
