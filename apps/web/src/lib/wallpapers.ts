export type WallpaperType = 'svg' | 'image';

export interface Wallpaper {
  id: string;
  name: string;
  type: WallpaperType;
  /** For 'svg' wallpapers — path to the SVG file */
  svgUrl?: string;
  /** For 'image' wallpapers — path to the light-mode image */
  lightUrl?: string;
  /** For 'image' wallpapers — path to the dark-mode image */
  darkUrl?: string;
  /** Small thumbnail for the picker */
  thumbnailUrl: string;
}

export const DEFAULT_WALLPAPER_ID = 'brandmark';

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'brandmark',
    name: 'Aether',
    type: 'svg',
    svgUrl: '/aether-brandmark-bg.svg',
    thumbnailUrl: '/aether-brandmark-bg.svg',
  },
];

export function getWallpaperById(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
