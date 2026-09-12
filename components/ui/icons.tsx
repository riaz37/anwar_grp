import {
  Search,
  Paperclip,
  Download,
  Lock,
  LockOpen,
  Plus,
  Check,
  ArrowLeft,
  ArrowUp,
  Square,
  Mail,
  MessageCircle,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  RotateCw,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { alias, type IconProps } from "@/components/shell/icons";

/**
 * Domain icon set for the project surface. Same construction rules and same
 * lucide-react source as `components/shell/icons.tsx` (see the note there on
 * why these are aliases rather than drawings); kept in a separate module so the
 * shell's navigation glyphs stay a closed, reviewable list.
 */
export type { IconProps };

export const SearchIcon = alias(Search);
export const PaperclipIcon = alias(Paperclip);
export const DownloadIcon = alias(Download);
export const LockIcon = alias(Lock);
export const UnlockIcon = alias(LockOpen);
export const PlusIcon = alias(Plus);
export const CheckIcon = alias(Check);
export const ArrowLeftIcon = alias(ArrowLeft);
export const MailIcon = alias(Mail);
export const CalendarIcon = alias(Calendar);
export const ClockIcon = alias(Clock);
export const MapPinIcon = alias(MapPin);
export const VideoIcon = alias(Video);
export const UsersIcon = alias(Users);
export const RetryIcon = alias(RotateCw);
export const ChevronRightIcon = alias(ChevronRight);
export const SendIcon = alias(ArrowUp);
export const StopIcon = alias(Square, { strokeWidth: 0, fill: "currentColor" });

/** lucide has no brand glyphs; WhatsApp is represented as a generic channel. */
export const WhatsAppIcon = alias(MessageCircle);

/**
 * Column-sort affordance.
 *
 * Three distinct glyphs rather than one rotated caret: in the unsorted state
 * the control must read as "sortable, either direction", which `ChevronsUpDown`
 * says without implying a direction the way a single caret would.
 *
 * Note this takes a real `direction` prop. React's `SVGAttributes` happens to
 * include a `direction` presentation attribute, so passing it to a plain icon
 * type-checks and then does nothing — the state has to be handled here.
 */
export function SortIcon({
  direction = "none",
  ...props
}: IconProps & { direction?: "asc" | "desc" | "none" }) {
  const Glyph =
    direction === "asc"
      ? ChevronUp
      : direction === "desc"
        ? ChevronDown
        : ChevronsUpDown;
  return (
    <Glyph size={14} strokeWidth={2} aria-hidden="true" focusable="false" {...props} />
  );
}
