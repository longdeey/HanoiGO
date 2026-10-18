/**
 * The signature component: a Hanoi street-name plate (white capitals on
 * street blue inside a white frame), set in Phudu. Used in exactly three places (home hero, festivals title, story
 * title). `paintOnce` plays M03 on the first home visit of a browser session;
 * the decision is made by a tiny script in the root layout before first paint
 * (see SIGN_PAINT_SCRIPT), so the sign never blinks after hydration.
 */
export function Signboard({ children, tone = "white", paintOnce = false, as: Tag = "h1", className = "", textClassName = "type-display", lang }: {
  children: React.ReactNode; tone?: "white" | "yellow"; paintOnce?: boolean;
  as?: "h1" | "h2" | "p"; className?: string; textClassName?: string; lang?: string;
}) {
  return <div className={`signboard ${tone === "yellow" ? "signboard-yellow" : ""} ${className}`} data-paint-target={paintOnce || undefined}>
    <div className="signboard-inner">
      <Tag className={`sign-letters ${textClassName}`} lang={lang}>{children}</Tag>
    </div>
  </div>;
}

/** The small street-name plate: section titles and photo captions. */
export function StreetPlate({ children, as: Tag = "h2", id, size = "md", className = "", lang }: {
  children: React.ReactNode; as?: "h1" | "h2" | "h3" | "p" | "span"; id?: string; size?: "sm" | "md" | "lg"; className?: string; lang?: string;
}) {
  return <Tag id={id} lang={lang} className={`street-plate ${size === "sm" ? "street-plate-sm" : size === "lg" ? "street-plate-lg" : ""} ${className}`}>
    <span>{children}</span>
  </Tag>;
}

export const SIGN_PAINT_SCRIPT = `try{if(location.pathname==='/'&&!sessionStorage.getItem('hanoigo-sign-painted')){sessionStorage.setItem('hanoigo-sign-painted','1');document.documentElement.dataset.signPaint='1'}}catch(e){}`;
