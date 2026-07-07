"use client";

import { useState } from "react";

interface Wall {
  provider: string;
  url: string;
}

export function OfferwallsView({ walls }: { walls: Wall[] }) {
  const [active, setActive] = useState(0);
  const current = walls[active] ?? walls[0];

  return (
    <div className="space-y-3">
      {walls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {walls.map((w, i) => (
            <button
              key={w.provider}
              onClick={() => setActive(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                i === active
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {w.provider.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      <div className="w-full h-[75vh] rounded-xl overflow-hidden border border-gray-800 bg-black">
        <iframe
          key={current.provider}
          src={current.url}
          title={current.provider}
          className="w-full h-full"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
