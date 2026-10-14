// JS mirror of tokens.css, for the handful of call sites that need a real
// color value rather than a CSS var string: SVG chart strokes/fills and
// framer-motion animated color props (e.g. animate={{ background: ... }}).
// Keep every hex in this file in sync with tokens.css — they're the same
// palette, just two different consumption shapes.
export const palette = {
  light: {
    bg:"#F5F4EF", surface:"#FFFFFF", surfaceAlt:"#EFEDE4", border:"#E0DDD1",
    ink:"#16233D", inkSoft:"#4B5875", muted:"#8A93A8",
    accent:"#AD7C24", accentInk:"#5B4110", accentSoft:"#F1E4C2",
    success:"#2E8B57", successSoft:"#E3F3EA",
    danger:"#C1443C", dangerSoft:"#FBE7E5",
    info:"#2F6FB2", infoSoft:"#E6EEF8",
    warn:"#A97A1F", warnSoft:"#F5E9D2",
    chart:["#AD7C24","#2F6FB2","#2E8B57","#C1443C","#6B5CA5","#B2562F","#3E8FA0","#8A5A8C"],
  },
  dark: {
    bg:"#0E1626", surface:"#152036", surfaceAlt:"#1A2540", border:"#2B3757",
    ink:"#EEF1F8", inkSoft:"#B7C0D9", muted:"#7C88A9",
    accent:"#D9AE52", accentInk:"#F3DFA0", accentSoft:"#2C2413",
    success:"#4CB783", successSoft:"#15301F",
    danger:"#E17067", dangerSoft:"#3A1917",
    info:"#6FA8DC", infoSoft:"#16283A",
    warn:"#D9AE52", warnSoft:"#2C2413",
    chart:["#D9AE52","#6FA8DC","#4CB783","#E17067","#9A8CD1","#D98A5E","#6FBFCF","#C08CC2"],
  },
};

export function chartColor(theme, index){
  return palette[theme].chart[index % palette[theme].chart.length];
}
