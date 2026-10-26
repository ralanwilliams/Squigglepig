import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { BackButton } from '../src/components/BackButton';
import { WinnerPig } from '../src/avatar/WinnerPig';
import { useMyAvatar } from '../src/avatar/avatar';
import { DEFAULT_SAY } from '../src/avatar/bubbles';
import { BUBBLE_MAX } from '../src/rewards/catalog';
import { cleanBubbleText, useInventory } from '../src/rewards/inventory';

// Your pig: how everyone in the room sees you when you win (src/avatar), and
// what its speech bubble says. The outfit and the bubble are chosen on the
// Rewards screen's tabs, like a theme; this screen shows them on the winner
// pig and takes the words.
//
// The words are kept as typed while the field is in use, and saved (cleaned:
// one line, at most BUBBLE_MAX characters) when it's left or the screen is,
// so a space typed at the end isn't trimmed away mid-word.
export default function Pig() {
  const { bubbleText, setBubbleText } = useInventory();
  const mine = useMyAvatar();
  const [draft, setDraft] = useState(bubbleText);
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => () => setBubbleText(latest.current), [setBubbleText]);

  const avatar = useMemo(() => ({ ...mine, say: cleanBubbleText(draft) }), [mine, draft]);

  return (
    <View style={styles.fill}>
      <Stage
        header={<Heading size="h3" lines={1}>Your pig</Heading>}
        focus={<WinnerPig avatar={avatar} />}
        actions={
          <>
            <Heading>When you win, everyone in the room sees your pig like this.</Heading>
            <PigInput
              placeholder={`What your pig says (${DEFAULT_SAY})`}
              value={draft}
              onChangeText={setDraft}
              onEndEditing={() => setBubbleText(draft)}
              maxLength={BUBBLE_MAX}
              autoCapitalize="sentences"
              accessibilityLabel="What your pig says"
            />
            {!mine.bubble ? <Heading>Win a speech bubble in Play Solo to show it.</Heading> : null}
            <PigButton name="Outfits" onPress={() => router.push('/rewards?kind=outfit')} />
            <PigButton name="Speech bubbles" onPress={() => router.push('/rewards?kind=bubble')} />
          </>
        }
      />
      <BackButton />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
