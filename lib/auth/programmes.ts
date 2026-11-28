// The programmes and years a student can choose when registering.
// The programmes mirror the `programmes` table; a test keeps the two in step.
export const PROGRAMMES = [
  { id: "AE", name: "Aerospace Engineering" },
  { id: "CSE", name: "Computer Science and Engineering" },
] as const;

export type ProgrammeId = (typeof PROGRAMMES)[number]["id"];

// Bachelor years. The database accepts 1 to 5, so master years can be added here later.
export const YEARS = [1, 2, 3] as const;

export function programmeName(id: string): string {
  return PROGRAMMES.find((programme) => programme.id === id)?.name ?? id;
}
