import type { Metadata } from "next";

import { StoriesPage } from "@/components/stories/StoriesPage";

export const metadata: Metadata = { title: "Stories" };

export default function Stories() {
  return <StoriesPage />;
}
