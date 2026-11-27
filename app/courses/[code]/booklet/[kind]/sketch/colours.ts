// The colours of the hand-drawn diagrams.
//
// Seven pencil colours in a fixed order, checked as a set on white for colour-blind
// separation between neighbours and for contrast (the chart palette validator: every check
// passes, four of them only with the labels and ink outlines the diagrams have). No violet.
// A thing keeps its colour wherever it is drawn: topic 3 is the same green in both booklets.
export const PENCILS = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#008a17", "#ec4647"] as const;

// For what belongs to no topic ("Other").
export const GREY_PENCIL = "#8a8782";

export type Pencil = {
  colour: string;
  // The eighth thing and later take the colours again, hatched crosswise: colour and
  // hatching together still tell every one apart.
  crossed: boolean;
};

export function pencil(index: number): Pencil {
  return { colour: PENCILS[index % PENCILS.length], crossed: index >= PENCILS.length };
}

export const GREY: Pencil = { colour: GREY_PENCIL, crossed: false };
