/// <reference types="expo/types" />
// Local-only developer tooling. Everything under ./local is gitignored, so it is
// never committed or shipped; on a fresh clone the folder is simply empty and
// these render nothing. Drop a .tsx file in ./local and it's picked up in dev
// builds automatically:
//   - its default export is shown in the lobby (<DevPanel/>), e.g. the button
//     that adds ghost players to play a full game on one phone;
//   - its `Overlay` export, if it has one, is mounted once over every screen
//     (<DevOverlay/>, in app/_layout.tsx), for tools that must keep running
//     the whole game through, e.g. autopilot.
// Metro only reads the folder in development: the __DEV__ guard is
// constant-folded away in release bundles, so the require.context call (and
// the local files) never reach them. Only the folder's top level is read:
// helpers a tool needs go in a subfolder.
import React from 'react';

const local = __DEV__ ? require.context('./local', false, /\.tsx$/) : null;

// Every local tool's export called `name`, keyed by its file.
function localExports(name: string): [string, React.ComponentType][] {
  if (!local) return [];
  return local
    .keys()
    .map((key): [string, React.ComponentType | undefined] => [key, local(key)[name]])
    .filter((entry): entry is [string, React.ComponentType] => !!entry[1]);
}

function renderAll(name: string) {
  return (
    <>
      {localExports(name).map(([key, Tool]) => (
        <Tool key={key} />
      ))}
    </>
  );
}

export function DevPanel() {
  return renderAll('default');
}

export function DevOverlay() {
  return renderAll('Overlay');
}
