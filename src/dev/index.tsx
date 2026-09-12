/// <reference types="expo/types" />
// Local-only developer tooling. Everything under ./local is gitignored, so it is
// never committed or shipped; on a fresh clone the folder is simply empty and
// <DevPanel/> renders nothing. Drop a .tsx file in ./local whose default export
// is a component (e.g. the ghost players used to play a full game on one phone)
// and it shows up in the lobby of dev builds automatically. Metro only reads the
// folder in development: the __DEV__ guard is constant-folded away in release
// bundles, so the require.context call (and the local files) never reach them.
import React from 'react';

const local = __DEV__ ? require.context('./local', false, /\.tsx$/) : null;

export function DevPanel() {
  if (!local) return null;
  return (
    <>
      {local.keys().map((key) => {
        const Tool = local(key).default as React.ComponentType | undefined;
        return Tool ? <Tool key={key} /> : null;
      })}
    </>
  );
}
