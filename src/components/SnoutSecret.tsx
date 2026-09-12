import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { PigButton } from './PigButton';
import { showToast } from './Toast';
import { DOCUMENTS } from '../assets/assets';

// Easter egg: an invisible button over the home pig's snout. Tap it seven
// times, Android-developer-mode style, and it offers to download a file.
//
// The rules mirror Settings' BuildNumberPreferenceController: seven taps in
// all; from the third tap on, a hint counts down the taps still needed; the
// seventh fires the reward. Android itself only resets the count when you
// leave the screen — here the taps must also come in quick succession, so
// stray taps over a whole session never creep up on the prize.
//
const TAPS = 7;
const TAP_WINDOW_MS = 1000; // max gap between taps before the count resets

// The reward: the developer's CV, bundled with the app.
const DOWNLOAD = { module: DOCUMENTS.cv, filename: 'Robert_Alan_Williams_CV.pdf' };

// Where the snout sits on IMAGES.home (954×900), as fractions of the frame.
const SNOUT = { left: '17%', top: '21%', width: '28%', height: '21%' } as const;

export function SnoutSecret() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const taps = useRef(0);
  const lastTap = useRef(0);

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current > TAP_WINDOW_MS) taps.current = 0;
    lastTap.current = now;
    taps.current += 1;

    const left = TAPS - taps.current;
    if (left <= 0) {
      taps.current = 0;
      setOpen(true);
    } else if (left < TAPS - 2) {
      showToast(`You are now ${left} ${left === 1 ? 'step' : 'steps'} away from the secret.`);
    }
  };

  const download = () => {
    setOpen(false);
    downloadAsset(DOWNLOAD).catch((e) => console.warn('snout secret download failed', e));
  };

  return (
    <>
      <Pressable accessible={false} onPress={onPress} style={[styles.snout, SNOUT]} />

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
          <View
            style={[
              styles.card,
              { maxWidth: ui.sp(420), borderRadius: ui.sp(12), padding: ui.sp(24), gap: ui.sp(16) },
            ]}
          >
            <Text
              style={[styles.quote, { fontSize: ui.f(18), lineHeight: ui.f(23) }]}
              maxFontSizeMultiplier={FONT_CAP}
            >
              Seven boops and you're in. Want a copy of the developer's CV?
            </Text>
            <View style={{ gap: ui.gap }}>
              <PigButton name="Download CV" onPress={download} />
              <PigButton name="Not now" onPress={() => setOpen(false)} silent />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Saves the bundled file where the user wants it. Web: a plain anchor
// download of the served asset. Native: neither OS lets an app drop a file
// into Downloads unasked, so the system folder picker opens (Files on iOS,
// the document tree on Android) and the PDF is copied into whatever folder
// is chosen. Cancelling the picker is not an error.
async function downloadAsset({ module, filename }: typeof DOWNLOAD) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();

  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = asset.uri;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (/cancel/i.test(`${(e as { code?: string })?.code} ${(e as Error)?.message}`)) return;
    throw e;
  }

  // The cached asset carries a hashed name; stage a copy under the real one so
  // it lands in the chosen folder as `filename`.
  const staged = new File(Paths.cache, filename);
  await new File(asset.localUri ?? asset.uri).copy(staged, { overwrite: true });
  await staged.copy(folder, { overwrite: true });
  showToast(`Saved ${filename} to ${folder.name}`, 2500);
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    snout: { position: 'absolute' },
    backdrop: {
      flex: 1,
      backgroundColor: t.scrim,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: { width: '100%', backgroundColor: t.overlay },
    quote: { color: t.overlayLabel, fontFamily: font.bold, textAlign: 'center', letterSpacing: 0.3 },
    text: { color: t.overlayText, fontFamily: font.regular, textAlign: 'center' },
  });
