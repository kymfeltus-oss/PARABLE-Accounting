export type PreloadCategory = {
  id: string;
  label: string;
  form: "1099-NEC";
  note?: string;
};

/** Pre-baked 1099-NEC lanes for guest / maintenance / audio / legal in white-label UX */
export const PRELOAD_CONTRACTOR_CATEGORIES: readonly PreloadCategory[] = [
  {
    id: "guest_speaker",
    label: "Pulpit supply / guest speakers",
    form: "1099-NEC",
  },
  {
    id: "maintenance",
    label: "Maintenance / janitorial crews",
    form: "1099-NEC",
  },
  {
    id: "audio_engineer",
    label: "Musicians / audio engineers",
    form: "1099-NEC",
  },
  {
    id: "legal",
    label: "Legal / professional services",
    form: "1099-NEC",
    note: "Attorneys often receive a 1099 in practice even when incorporated; confirm with counsel.",
  },
];

export type PreloadCategoryId = PreloadCategory["id"];
