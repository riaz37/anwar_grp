import { Wordmark } from "@/components/shell/Wordmark";

/** Unauthenticated shell — no navigation, nothing to reach until sign-in. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center px-md">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-md py-2xl">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-[720px] px-md pb-lg">
        <p className="text-caption text-muted">
          Internal system — Anwar Group Talent Acquisition. Access is recorded
          in the audit log.
        </p>
      </footer>
    </div>
  );
}
