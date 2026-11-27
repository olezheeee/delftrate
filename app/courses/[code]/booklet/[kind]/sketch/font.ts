// The handwriting of the hand-drawn booklet. One hand for the whole sheet: a booklet reads
// as written by one person. Loaded only by the pages that use it.
import { Shantell_Sans } from "next/font/google";

export const hand = Shantell_Sans({
  variable: "--font-hand",
  subsets: ["latin"],
  // Informality: how irregular the letters are. Set per kind of text in the stylesheet.
  axes: ["INFM"],
  display: "swap",
});
