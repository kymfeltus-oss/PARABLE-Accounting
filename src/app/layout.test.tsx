import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({
    variable: "--font-inter",
    className: "mock-inter",
  }),
  Space_Grotesk: () => ({
    variable: "--font-space-grotesk",
    className: "mock-space-grotesk",
  }),
  Geist_Mono: () => ({
    variable: "--font-geist-mono",
    className: "mock-geist-mono",
  }),
}));

import RootLayout, { metadata, viewport } from "./layout";

type RootElementProps = {
  children?: ReactNode;
  className?: string;
  lang?: string;
};

type ElementWithChildrenProps = {
  children?: ReactNode;
};

function expectReactElement<P extends object>(node: ReactNode): ReactElement<P> {
  expect(isValidElement<P>(node)).toBe(true);

  if (!isValidElement<P>(node)) {
    throw new Error("Expected a valid React element.");
  }

  return node;
}

function getElementChildren(node: ReactNode) {
  return Children.toArray(node).filter(
    (child): child is ReactElement<ElementWithChildrenProps> =>
      isValidElement<ElementWithChildrenProps>(child),
  );
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (isValidElement<ElementWithChildrenProps>(node)) {
    return getTextContent(node.props.children);
  }

  return "";
}

describe("RootLayout", () => {
  it("exports the application metadata", () => {
    expect(metadata.title).toEqual({
      default: "Parable Accounting",
      template: "%s | Parable Accounting",
    });
    expect(metadata.description).toBe(
      "Ministry Finance OS — accounting and financial stewardship for churches and ministries.",
    );
  });

  it("exports a device-width viewport for responsive layout", () => {
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
    });
  });

  it("returns html lang en with a body containing child content", () => {
    const result = RootLayout({
      children: <p>Root child content</p>,
    });
    const root = expectReactElement<RootElementProps>(result);

    expect(root.type).toBe("html");
    expect(root.props.lang).toBe("en");
    expect(String(root.props.className ?? "")).toContain("overflow-x-clip");

    const body = getElementChildren(root.props.children).find(
      (child) => child.type === "body",
    );

    expect(body).toBeDefined();

    if (!body) {
      throw new Error("Expected RootLayout to render a body element.");
    }

    expect(getTextContent(body.props.children)).toContain("Root child content");
  });

  it("does not inject login, signup, authentication UI, or fake financial data", () => {
    const result = RootLayout({ children: null });
    const root = expectReactElement<RootElementProps>(result);
    const layoutOwnedText = getTextContent(root.props.children);

    expect(layoutOwnedText).not.toMatch(
      /log in|login|sign up|signup|authentication/i,
    );
    expect(layoutOwnedText).not.toMatch(/\$\s?\d|\b\d+\.\d{2}\b/);
  });
});
