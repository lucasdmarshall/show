"use client";

import { useEffect, useRef, useState } from "react";
import "./drop.css";

/* Where a photograph comes in — by drop, by picker, or by paste. */

type Props = {
  my: boolean;
  title: string;
  titleMy: string;
  sub: string;
  subMy: string;
  busy?: boolean;
  error?: string | null;
  onFile?: (file: File | null | undefined) => void;
  /** Take a whole shoot at once instead of one photograph. */
  onFiles?: (files: File[]) => void;
  /** Accept attribute; photographs by default. */
  accept?: string;
  /** Room for a second way in, under the button. */
  children?: React.ReactNode;
};

const images = (list: FileList | File[] | null | undefined) =>
  [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

export function DropZone({
  my,
  title,
  titleMy,
  sub,
  subMy,
  busy,
  error,
  onFile,
  onFiles,
  accept = "image/*",
  children,
}: Props) {
  const multiple = Boolean(onFiles);
  const give = (list: FileList | File[] | null | undefined) => {
    if (onFiles) {
      const f = images(list);
      if (f.length) onFiles(f);
    } else onFile?.(list?.[0]);
  };
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;
      if (onFiles) onFiles(files);
      else onFile?.(files[0]);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile, onFiles]);

  return (
    <div
      className="drop"
      data-dragging={dragging || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        give(e.dataTransfer.files);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="drop__icon">
        <path
          d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <h2 className={my ? "my drop__title" : "t-h3 drop__title"}>{my ? titleMy : title}</h2>
      <p className={my ? "my drop__sub" : "t-small drop__sub"}>{my ? subMy : sub}</p>

      <button
        type="button"
        className="btn"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy
          ? my
            ? "ဖတ်နေသည်…"
            : "Reading…"
          : multiple
            ? my
              ? "ဖိုင်များ ရွေးမည်"
              : "Choose files"
            : my
              ? "ဖိုင် ရွေးမည်"
              : "Choose a file"}
      </button>

      {children}

      <p className="drop__privacy t-micro">
        {my ? "ဓာတ်ပုံက ဒီစက်ထဲကနေ ဘယ်မှ မထွက်ပါ" : "The photograph never leaves this device"}
      </p>

      {error ? (
        <p className={`drop__err ${my ? "my" : "t-small"}`} role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          give(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
