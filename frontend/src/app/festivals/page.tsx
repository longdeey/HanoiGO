import type { Metadata } from "next";

import { FestivalsPage } from "@/components/festivals/FestivalsPage";

export const metadata: Metadata = { title: "Festivals" };

export default function Festivals() {
  return <FestivalsPage />;
}
