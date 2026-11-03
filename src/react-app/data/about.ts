export type AstroPhoto = {
  src: string;
  alt: string;
  caption: string;
  details?: string;
  side: "left" | "right";
};

// Ammar's own photographs belong here when supplied. No stock substitutions.
export const astrophotography: AstroPhoto[] = [];
