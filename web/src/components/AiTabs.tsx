"use client";

/* The two ways a fix room can work. The model is the main way — it is
   simply better at it — and the device is the free, private second way. */

export type Way = "ai" | "device";

export function AiTabs({ way, onWay, my }: { way: Way; onWay: (w: Way) => void; my: boolean }) {
  return (
    <div className="seg ai-tabs" role="group" aria-label={my ? "ဘယ်လို ပြင်မလဲ" : "How to fix it"}>
      <button type="button" className={my ? "my" : undefined} aria-pressed={way === "ai"} onClick={() => onWay("ai")}>
        ✦ {my ? "AI နဲ့" : "With AI"}
      </button>
      <button type="button" className={my ? "my" : undefined} aria-pressed={way === "device"} onClick={() => onWay("device")}>
        {my ? "ဖုန်းပေါ်မှာ · အခမဲ့" : "On this device · free"}
      </button>
    </div>
  );
}
