import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold">Client not found</h1>
        <p className="mt-2 text-sm text-ink-500">
          That client isn&apos;t configured in this portal. Check{" "}
          <code>PORTAL_CLIENTS</code> or pick a client below.
        </p>
        <Link href="/" className="btn-primary mt-5">
          Back to clients
        </Link>
      </div>
    </div>
  );
}
