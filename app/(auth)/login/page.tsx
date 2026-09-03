import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Anwar AI ProjectFlow.",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-title text-text">Sign in</h1>
      <p className="mt-2xs mb-xl max-w-[52ch] text-body text-muted">
        Use your Anwar Group work email. If you don’t have an account yet,
        your AI Team Lead creates one for you.
      </p>

      <LoginForm />

      <p className="mt-xl border-t border-border pt-md text-body-sm text-muted">
        Trouble signing in? Contact your AI Team Lead or{" "}
        <a className="link" href="mailto:it-support@anwargroup.example">
          IT support
        </a>
        .
      </p>
    </div>
  );
}
