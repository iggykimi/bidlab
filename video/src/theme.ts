import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// The video speaks the app's visual language: same ink, blue and paper,
// same typeface. Nothing on screen should look like a different product.
export const C = {
  paper: "#f7f8fa",
  ink: "#18243b",
  muted: "#3b4a5e",
  blue: "#2748b8",
  blueInk: "#162d75",
  soft: "#edf1ff",
  green: "#176046",
  amber: "#795000",
  white: "#ffffff",
};

export const FONT = '"BidLab Figures", "Atkinson Hyperlegible Next", sans-serif';

const faces: Array<[string, string, string]> = [
  ["Atkinson Hyperlegible Next", "atkinson-hyperlegible-next-latin-400-normal.woff2", "400"],
  ["Atkinson Hyperlegible Next", "atkinson-hyperlegible-next-latin-700-normal.woff2", "700"],
  ["Atkinson Hyperlegible Next", "atkinson-hyperlegible-next-latin-800-normal.woff2", "800"],
];

export const fontsReady = Promise.all([
  ...faces.map(([family, file, weight]) =>
    loadFont({ family, url: staticFile(`fonts/${file}`), weight })
  ),
  // Same rule as the app: figures from Inter so a zero never reads as "Ø".
  loadFont({
    family: "BidLab Figures",
    url: staticFile("fonts/inter-latin-wght-normal.woff2"),
    weight: "100 900",
    unicodeRange: "U+0030-0039",
  }),
]);
