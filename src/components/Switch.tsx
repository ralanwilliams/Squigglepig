import React from 'react';
import { View } from 'react-native';
import { type Theme } from '../theme/tokens';
import { type Ui } from '../theme/responsive';

// The switch on a setting row (the menu drawer, the Rewards screen): a pill in
// the link color. On, it is filled with the knob at the right; off, it is an
// outline with the knob at the left — so it reads by shape and position, not
// by color. Only a picture: the row around it is what's pressed.
export function Switch({ on, ui, theme }: { on: boolean; ui: Ui; theme: Theme }) {
  const w = ui.sp(38);
  const h = ui.sp(22);
  const knob = h - ui.sp(8);
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        borderWidth: ui.sp(2),
        borderColor: theme.link,
        backgroundColor: on ? theme.link : 'transparent',
        justifyContent: 'center',
        alignItems: on ? 'flex-end' : 'flex-start',
        paddingHorizontal: ui.sp(2),
      }}
    >
      <View style={{ width: knob, height: knob, borderRadius: knob / 2, backgroundColor: on ? theme.background : theme.link }} />
    </View>
  );
}
