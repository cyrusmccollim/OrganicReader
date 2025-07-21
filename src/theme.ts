export const ACCENT_COLORS = [
  { id: 'forest',   name: 'Forest',   value: '#6bb584', dark: '#5a9c6f', light: '#7fc894' },
  { id: 'ocean',    name: 'Ocean',    value: '#5599bb', dark: '#4488aa', light: '#66aacc' },
  { id: 'dusk',     name: 'Dusk',     value: '#c4845a', dark: '#b07048', light: '#d4986e' },
  { id: 'lavender', name: 'Lavender', value: '#8b7ec8', dark: '#7a6eb8', light: '#9e92d4' },
  { id: 'rose',     name: 'Rose',     value: '#c87e8a', dark: '#b86e7a', light: '#d8929e' },
  { id: 'amber',    name: 'Amber',    value: '#c4a052', dark: '#b08e42', light: '#d4b264' },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export function buildTheme(isDark: boolean, accent: AccentColor) {
  const colors = isDark
    ? {
        darkBg:       '#0d0d0d',
        darkerBg:     '#080808',
        surface:      '#1c1c1c',
        surfaceHigh:  '#242424',
        primary:      accent.value,
        primaryLight: accent.light,
        primaryDark:  accent.dark,
        textPrimary:  '#f0f0f0',
        textSecondary:'#909090',
        border:       '#2d2d2d',
        disabled:     '#3d3d3d',
      }
    : {
        darkBg:       '#f5f5f5',
        darkerBg:     '#ebebeb',
        surface:      '#ffffff',
        surfaceHigh:  '#fafafa',
        primary:      accent.value,
        primaryLight: accent.light,
        primaryDark:  accent.dark,
        textPrimary:  '#1a1a1a',
        textSecondary:'#606060',
        border:       '#dedede',
        disabled:     '#b8b8b8',
      };

  return {
    colors,
    isDark,
    spacing:      { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
    borderRadius: { sm: 8, md: 12, lg: 16 },
  };
}

// Static default for type reference
export const theme = buildTheme(true, ACCENT_COLORS[0]);
export type Theme = ReturnType<typeof buildTheme>;
