import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UiGallery } from "@/components/dev/UiGallery";

export const metadata: Metadata = { title: "UI gallery", robots: { index: false } };

// Spec P1: the component gallery exists only in development.
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
