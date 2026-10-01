import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "SHOW — Photographs, finished.",
  description:
    "Myanmar's photo studio with AI: restore, relight, replace and deliver with Nano Banana Pro and GPT Image — before against after at every step.",
};

export default function Home() {
  return <Landing />;
}
