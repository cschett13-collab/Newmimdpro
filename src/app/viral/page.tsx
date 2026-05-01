import type { Metadata } from "next";
import HotTakeApp from "./HotTakeApp";
import { decodeTake, makeShareTitle } from "./takes";

export const dynamic = "force-dynamic";

type SearchParams = { t?: string; c?: string };

export function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Metadata {
  const decoded = searchParams.t ? decodeTake(searchParams.t) : null;
  const title = decoded
    ? `🔥 "${makeShareTitle(decoded.text)}"`
    : "🔥 Hot Take Generator";
  const description = decoded
    ? decoded.text
    : "Generate a spicy hot take. Share if you dare.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  const initial = searchParams.t ? decodeTake(searchParams.t) : null;
  const initialCategory = searchParams.c ?? null;
  return <HotTakeApp initialTake={initial} initialCategory={initialCategory} />;
}
