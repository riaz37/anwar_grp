/**
 * Full-bleed canvas for the dedicated chat page: cancels AppShell `<main>`'s
 * padding (DESIGN.md's page container isn't right for a ChatGPT-style
 * sidebar + thread layout) and pins the height to the viewport under the
 * 76px top bar so only the sidebar and thread scroll, never the page itself.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-ds-2xl -my-ds-4xl h-[calc(100dvh-76px-64px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-76px)] lg:-mx-ds-9xl lg:-my-ds-7xl">
      {children}
    </div>
  );
}
