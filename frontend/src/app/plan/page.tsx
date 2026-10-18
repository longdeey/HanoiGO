import { Suspense } from "react";
import type { Metadata } from "next";

import { PlanFlow } from "@/components/plan/PlanFlow";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return <Suspense><PlanFlow /></Suspense>;
}
