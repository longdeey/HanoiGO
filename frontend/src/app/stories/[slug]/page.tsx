import type { Metadata } from "next";

import { StoryReaderPage } from "@/components/stories/StoryReaderPage";

export const metadata: Metadata = { title: "Story" };

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StoryReaderPage slug={decodeURIComponent(slug)} />;
}
