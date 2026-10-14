// Temporary compatibility bridge for Chat.jsx/AI.jsx, which still import
// {themes, C, F, ...} in the OLD role-keyed shape (C.indigo, C.txt, etc.)
// rather than the new CSS-var token system. Both files work correctly today
// and are deliberately left untouched until Phase 7 reskins them directly —
// see the rebuild plan. Delete this file once that reskin lands.
//
// `C` is a mutable `let` binding, exactly like the original in asad.jsx:
// ES module named imports are live bindings, so importers see updates when
// setLegacyTheme() reassigns C here — no context/props threading needed for
// these two legacy consumers.
export const themes = {
  dark: {
    bg:"#0a0d14", bg2:"#0e121b", panel:"#10141e", surface:"#151a26", surface2:"#1a2030",
    border:"rgba(233,225,208,0.08)", borderMd:"rgba(233,225,208,0.15)",
    indigo:"#c9974c", indigoLt:"#e3bd7c", cyan:"#6fa3ad", emerald:"#4f9a72",
    rose:"#c15a56", amber:"#d9a53e", violet:"#6d7fc4", purple:"#9077b0", pink:"#bb7791",
    sky:"#8fb8c9", orange:"#c17a45",
    txt:"#eae6da", txt2:"#9d9686", dim:"rgba(234,230,218,0.2)",
    success:"#4f9a72", error:"#c15a56", warn:"#d9a53e", info:"#6fa3ad",
  },
  light: {
    bg:"#f3f4f7", bg2:"#f8f9fb", panel:"#ffffff", surface:"#ffffff", surface2:"#eef0f4",
    border:"rgba(20,24,38,0.10)", borderMd:"rgba(20,24,38,0.17)",
    indigo:"#9c6f2e", indigoLt:"#b98a42", cyan:"#4d7d86", emerald:"#2f7a52",
    rose:"#a8433f", amber:"#a97a1f", violet:"#4a5a96", purple:"#6f5a8c", pink:"#965a72",
    sky:"#4f7f92", orange:"#a15c30",
    txt:"#171a26", txt2:"#545a6e", dim:"rgba(23,26,38,0.2)",
    success:"#2f7a52", error:"#a8433f", warn:"#a97a1f", info:"#4d7d86",
  }
};

export let C = themes.dark;
export const F = "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif";

export function setLegacyTheme(theme) {
  C = themes[theme] || themes.dark;
}
