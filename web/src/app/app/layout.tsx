import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SHOW Studio",
  description: "Myanmar's photo studio.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
