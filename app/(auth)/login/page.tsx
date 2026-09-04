import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Anwar AI ProjectFlow.",
};

/**
 * The card follows DESIGN.md's modal recipe verbatim — `surface-1`,
 * `outline-low` hairline, `rounded-5xl`, `shadow-e6` — because it is the most
 * elevated surface on the page and the app already teaches that shape as
 * "the thing to deal with right now".
 */
export default function LoginPage() {
  return (
    <div className="w-full">
      <section className="overflow-hidden rounded-5xl border border-outline-low bg-surface-1 shadow-e6">
        <div className="border-b border-outline-low px-ds-7xl py-ds-6xl">
          <p className="annotation">Anwar AI ProjectFlow</p>
          <h1 className="mt-ds-lg text-balance text-heading-2 text-text-high">
            Sign in
          </h1>
          <p className="mt-ds-md max-w-[52ch] text-pretty text-para text-text-med">
            Use your Anwar Group work email. If you don&rsquo;t have an account
            yet, your AI Team Lead creates one for you.
          </p>
        </div>

        <div className="px-ds-7xl py-ds-7xl">
          <LoginForm />
        </div>
      </section>

      <p className="mt-ds-5xl px-ds-md text-pretty text-para text-text-low">
        Trouble signing in? Contact your AI Team Lead or{" "}
        <a className="link" href="mailto:it-support@anwargroup.example">
          IT support
        </a>
        .
      </p>
    </div>
  );
}
