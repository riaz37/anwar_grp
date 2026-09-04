import type { ComponentProps } from "react";
import {
  House,
  ListChecks,
  FolderKanban,
  ChartNoAxesColumn,
  Settings,
  Menu,
  X,
  LogOut,
  Inbox,
  ChevronRight,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation/chrome icon set.
 *
 * These were previously hand-drawn SVGs on a 24px grid at 1.5px stroke. They
 * are now aliases onto lucide-react — the same grid and construction rules, but
 * a maintained set with consistent optical weight across ~1500 glyphs, so
 * adding a nav entry no longer means drawing one.
 *
 * The named exports are kept verbatim (`HomeIcon`, `MenuIcon`, …) so call sites
 * and `nav-items.ts`'s `ComponentType<SVGProps<SVGSVGElement>>` contract are
 * unchanged.
 */
export type IconProps = ComponentProps<LucideIcon>;

/**
 * lucide ships 24px/2px-stroke by default; DESIGN.md's minimal register wants
 * the lighter 20px/1.5px weight the hand-drawn set used, so every alias is
 * created through this factory rather than re-exported raw.
 */
export function alias(Glyph: LucideIcon, defaults?: Partial<IconProps>) {
  function Aliased(props: IconProps) {
    return (
      <Glyph
        size={20}
        strokeWidth={1.5}
        aria-hidden="true"
        focusable="false"
        {...defaults}
        {...props}
      />
    );
  }
  Aliased.displayName = `Icon(${Glyph.displayName ?? "lucide"})`;
  return Aliased;
}

export const HomeIcon = alias(House);
export const TasksIcon = alias(ListChecks);
export const ProjectsIcon = alias(FolderKanban);
export const ReportsIcon = alias(ChartNoAxesColumn);
export const AdministrationIcon = alias(Settings);
export const MenuIcon = alias(Menu);
export const CloseIcon = alias(X);
export const SignOutIcon = alias(LogOut);

/** Breadcrumb separator + disclosure affordance. Smaller than a nav glyph. */
export const ChevronRightIcon = alias(ChevronRight, { size: 14 });
export const LightThemeIcon = alias(Sun, { size: 16 });
export const DarkThemeIcon = alias(Moon, { size: 16 });

/** Empty-state illustration — larger and lighter than an inline nav glyph. */
export const EmptyTasksIcon = alias(Inbox, { size: 32, strokeWidth: 1.25 });
