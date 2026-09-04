import { Wordmark } from "@/components/shell/Wordmark";

/**
 * Unauthenticated shell — no navigation, nothing to reach until sign-in, so
 * the page is a single centred column on the shell surface rather than the
 * rail/topbar chrome the app uses everywhere else. The column caps at
 * `--container-form` (576px, DESIGN.md > Layout), the same width the modal
 * recipe uses — the sign-in card *is* a modal that happens to own the page.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-surface-shell px-ds-5xl">
      {/* One interactive element above the form (the wordmark), so a skip link
          would cost a keyboard user more than it saves. The shell adds one as
          soon as there is navigation to skip. */}
      <header className="mx-auto flex w-full max-w-form items-center pt-ds-7xl">
        <Wordmark />
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center py-ds-9xl"
      >
        {children}
      </main>

      <footer className="mx-auto w-full max-w-form pb-ds-9xl">
        <p className="max-w-[62ch] text-pretty text-caption-2 text-text-low">
          Internal system. Anwar Group AI &amp; Digital Transformation. Access
          is recorded in the audit log.
        </p>
      </footer>
    </div>
  );
}
