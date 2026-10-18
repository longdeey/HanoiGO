import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("homepage", () => {
  it("shows the product and its purpose", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("HanoiGO");
    expect(html).toContain("More Hanoi. Less planning.");
  });
});
