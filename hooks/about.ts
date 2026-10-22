/** A card's description: shown whole when it fits on one line, folded behind a ▸ only when it would be cut. */

/** Whether a description is cut on one line of `cols` cells (and so gets the ▸ to unfold it); never when unknown. */
export function aboutFolds(about: string, cols: number | null): boolean {
  if (cols === null) return false
  return [...`“${about}”`].length > cols
}
