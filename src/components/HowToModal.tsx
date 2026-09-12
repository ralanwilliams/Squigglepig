import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { FitBox } from './FitBox';
import { PigButton } from './PigButton';

// The original "Learn to Squiggle" help modal (dark card, palevioletred title).
// One tagline, one paragraph. Nothing scrolls: the card respects the safe area
// and FitBox shrinks the text to fit whatever height is left.
export function HowToModal() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.trigger, { minHeight: ui.sp(40), paddingVertical: ui.sp(8) }]}
        hitSlop={6}
      >
        <Text style={[styles.triggerText, { fontSize: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP}>
          Learn to Squiggle
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.backdrop,
            {
              paddingTop: ui.insets.top + ui.pad,
              paddingBottom: ui.insets.bottom + ui.pad,
              paddingLeft: ui.insets.left + ui.pad,
              paddingRight: ui.insets.right + ui.pad,
            },
          ]}
        >
          <View style={[styles.card, { maxWidth: ui.sp(560), borderRadius: ui.sp(12) }]}>
            <FitBox style={styles.flex}>
              <View style={{ padding: ui.sp(24), gap: ui.sp(16) }}>
                <Text style={[styles.quote, { fontSize: ui.f(32) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Draw squiggles. Get giggles.
                </Text>
                <Text style={[styles.text, { fontSize: ui.f(15), lineHeight: ui.f(23) }]} maxFontSizeMultiplier={FONT_CAP}>
                  One of you taps <Text style={styles.b}>Create Game</Text> and shares the room code;
                  everyone else taps <Text style={styles.b}>Join Game</Text> and types it in. Once
                  you're all in the lobby, the host starts things off and everybody tosses a few
                  prompts into the trough. Each round you're handed a prompt to{' '}
                  <Text style={styles.b}>draw</Text>, then someone else's drawing to{' '}
                  <Text style={styles.b}>guess</Text> — your guess becomes the next player's thing to
                  draw, and so on around the table. Telephone, but with squiggles. For fine detail,
                  tap <Text style={styles.b}>2×</Text> on the canvas and slide with two fingers to
                  move around. When a chain has
                  been through everyone, it's revealed one step at a time and whoever wrote the
                  original prompt judges each drawing and guess against it. Every match earns its
                  maker a point, and the first to the target score wins.
                </Text>
              </View>
            </FitBox>
            <View style={{ padding: ui.pad }}>
              <PigButton name="Close" onPress={() => setOpen(false)} silent />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  trigger: { alignItems: 'center', justifyContent: 'center' },
  triggerText: { color: t.link, fontFamily: font.bold },
  backdrop: {
    flex: 1,
    backgroundColor: t.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: t.overlay,
    overflow: 'hidden',
  },
  quote: { color: t.overlayLabel, fontFamily: font.bold, textAlign: 'center', letterSpacing: 0.3 },
  text: { color: t.overlayText, fontFamily: font.regular, textAlign: 'center' },
  b: { color: t.brand, fontFamily: font.bold },
});
