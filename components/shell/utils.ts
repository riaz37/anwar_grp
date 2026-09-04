/**
 * Small presentation-only helpers shared by the shell's profile affordances
 * (sidebar bottom block, mobile drawer footer). No routing/auth logic here —
 * see `nav-items.ts` and `LogoutButton.tsx` for that.
 */

/** "Nasrin Akter" -> "NA". Caps at two characters, the same shape a two-word
 *  name and a single-word name both fit into. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
