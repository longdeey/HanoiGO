"use client";

import Link from "next/link";

import { usePrefs } from "@/lib/prefs";
import { usePageChrome } from "@/components/shell/chrome";

// Each line states what the code does today; update it with the code.
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Saved in this browser",
    items: [
      "Your sign-in session, and for trips planned on this device the code that lets you edit them and the last share link you created. Signing out removes the trips from this browser.",
      "The stories you have read.",
      "Your language and appearance choices, as cookies.",
      "The plan form you are filling in, only in this tab. It is cleared once the itinerary is planned.",
    ],
  },
  {
    title: "Sent to HanoiGO",
    items: [
      "Your trip request, including the starting point, is stored with the trip so it can be opened again.",
      "An account (email or phone number, password and display name) is needed to plan a trip. Your trips are saved to it, so you can open them on any device where you sign in.",
      "Reviews are shown with your display name.",
      "Anyone with a share link can view that trip. Creating a new link stops the old one.",
    ],
  },
  {
    title: "Your location",
    items: [
      "HanoiGO asks for your location only when you choose to use your current location. The coordinates are sent only in the trip request and kept with that trip.",
    ],
  },
  {
    title: "Other services",
    items: [
      "An address you type is looked up by HanoiGO's server with OpenStreetMap's Nominatim service when you plan a trip.",
      "Map images load from a map tile server (OpenStreetMap France by default).",
      "Weather comes from Open-Meteo and road routes from OSRM. HanoiGO's server asks these services for you.",
      "Directions open in Google Maps in a new tab.",
    ],
  },
];

export function PrivacyPage() {
  const { tr } = usePrefs();
  usePageChrome({ title: tr("Privacy"), backHref: "/account" });
  return <div className="mx-auto max-w-read px-4 pb-12 sm:px-6">
    <h1 className="type-h1 pt-4 lg:pt-8">{tr("Privacy")}</h1>
    <p className="mt-3 text-ink-muted">{tr("This page describes how this version of HanoiGO handles your data.")}</p>
    {SECTIONS.map((section) => <section key={section.title} className="mt-8">
      <h2 className="type-h3">{tr(section.title)}</h2>
      <ul className="mt-2 list-disc space-y-2 pl-6">{section.items.map((item) => <li key={item}>{tr(item)}</li>)}</ul>
    </section>)}
    <p className="mt-8">{tr("You can remove a trip from your account on the Trips page.")}{" "}
      <Link href="/trips" className="font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("Open Trips")}</Link></p>
  </div>;
}
