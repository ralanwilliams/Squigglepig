import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../../src/components/Stage';
import { Logo } from '../../src/components/Logo';
import { Heading } from '../../src/components/Heading';
import { PigButton } from '../../src/components/PigButton';
import { BackButton } from '../../src/components/BackButton';
import { TextLink } from '../../src/components/TextLink';
import { IMAGES } from '../../src/assets/assets';
import { PLAYABLE } from '../../src/arcade/games';

// Solo, from Home's Play Solo button: one button per game this build offers
// (src/arcade/games PLAYABLE), and the way to the rewards they win. Each game
// runs at /arcade/<id> (./[game].tsx). Home shows the button only while
// there's a game to play.
export default function Arcade() {
  return (
    <View style={styles.fill}>
      <Stage
        header={<Heading size="h3" lines={1}>Play Solo</Heading>}
        focus={<Logo source={IMAGES.home} />}
        actions={
          <>
            <Heading>Win rounds in a row to fill the pot, then bank it for a reward.</Heading>
            {PLAYABLE.map((g) => (
              <PigButton key={g.id} name={g.label} onPress={() => router.push(`/arcade/${g.id}`)} />
            ))}
            <TextLink label="Your rewards" onPress={() => router.push('/rewards')} />
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
