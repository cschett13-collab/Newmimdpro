import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-ink-100 text-sm tracking-wide uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Fox Valley Client Engine
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Client Portal
          </h1>
          <p className="mt-1 text-ink-300 text-sm">
            Live reporting · powered by HighLevel · operated by IMD
          </p>
        </div>
        <div className="card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
