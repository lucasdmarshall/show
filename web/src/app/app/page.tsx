"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Studio, type CreateSeed, type StudioSeed } from "@/components/Studio";
import { Create } from "@/components/Create";
import { Reverse } from "@/components/Reverse";
import { Library } from "@/components/Library";
import { Grade } from "@/components/Grade";
import { Batch } from "@/components/Batch";
import { Restore } from "@/components/Restore";
import { Harmonize } from "@/components/Harmonize";
import { Background } from "@/components/Background";
import { Baby } from "@/components/Baby";
import { Album } from "@/components/Album";
import { Work } from "@/components/Work";
import { Portfolio } from "@/components/Portfolio";
import { Event } from "@/components/Event";
import { addVersion, saveNew, type Snapshot } from "@/lib/library";
import type { SectionId } from "@/lib/sections";

type Handoff = StudioSeed & { id: number };
/** What a save from Studio should branch off, once one is open. */
type Anchor = { entry: string; version: string | null };

export default function Page() {
  const [section, setSection] = useState<SectionId>("studio");
  const [my, setMy] = useState(false);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [createSeed, setCreateSeed] = useState<(CreateSeed & { id: number }) | null>(null);

  /* Studio and Reverse hand their prompt to Create, which starts fresh with it */
  const toCreate = (seed: CreateSeed) => {
    setCreateSeed({ ...seed, id: Date.now() });
    setSection("create");
  };

  /* Remounting Studio on a new handoff seeds it without an effect. */
  const seedStudio = (seed: StudioSeed) => {
    setHandoff({ ...seed, id: Date.now() });
    setSection("studio");
  };

  /* First save starts an entry; later ones branch off whatever is open. */
  const save = (title: string, snap: Snapshot) => {
    if (anchor) {
      const v = addVersion(anchor.entry, anchor.version, title, snap);
      setAnchor({ entry: anchor.entry, version: v });
    } else {
      setAnchor(saveNew(title, snap));
    }
  };

  const openFromLibrary = (snap: Snapshot, entry: string, version: string) => {
    setAnchor({ entry, version });
    seedStudio({
      mode: snap.mode,
      selection: snap.selection,
      aspect: snap.aspect,
      extra: snap.extra ?? snap.parts?.join(", "),
    });
  };

  return (
    <AppShell section={section} onSection={setSection} my={my} onMy={setMy}>
      {section === "studio" ? (
        <Studio
          key={handoff?.id ?? "base"}
          my={my}
          seed={handoff ?? undefined}
          onSave={save}
          onImage={toCreate}
        />
      ) : section === "create" ? (
        <Create key={createSeed?.id ?? "base"} my={my} seed={createSeed ?? undefined} />
      ) : section === "reverse" ? (
        <Reverse
          my={my}
          onSendToStudio={(s) => {
            setAnchor(null);
            seedStudio(s);
          }}
          onSave={(t, snap) => {
            setAnchor(null);
            save(t, snap);
          }}
          onImage={toCreate}
        />
      ) : section === "library" ? (
        <Library my={my} onOpen={openFromLibrary} />
      ) : section === "grade" ? (
        <Grade my={my} />
      ) : section === "batch" ? (
        <Batch my={my} />
      ) : section === "restore" ? (
        <Restore my={my} />
      ) : section === "harmonize" ? (
        <Harmonize my={my} />
      ) : section === "background" ? (
        <Background my={my} onGo={setSection} />
      ) : section === "baby" ? (
        <Baby my={my} />
      ) : section === "album" ? (
        <Album my={my} />
      ) : section === "work" ? (
        <Work my={my} onGo={setSection} />
      ) : section === "portfolio" ? (
        <Portfolio my={my} onGo={setSection} />
      ) : (
        <Event my={my} />
      )}
    </AppShell>
  );
}
