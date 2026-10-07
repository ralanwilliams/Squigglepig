import { Asset } from 'expo-asset';

// Pixel size of a bundled image (a require()'d module). React Native's
// Image.resolveAssetSource does this on iOS/Android but doesn't exist on web;
// expo-asset reads the same metadata Metro records at bundle time on every
// platform. Falls back to 1x1 so aspect maths never divides by zero.
export function assetSize(mod: number): { width: number; height: number } {
  const a = Asset.fromModule(mod);
  return { width: a.width || 1, height: a.height || 1 };
}
