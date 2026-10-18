import type { Metadata } from "next";

import { PrivacyPage } from "@/components/account/PrivacyPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return <PrivacyPage />;
}
