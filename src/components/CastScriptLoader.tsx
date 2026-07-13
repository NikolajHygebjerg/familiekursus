"use client";

import { useEffect } from "react";
import { initCastSender } from "@/lib/cast/sender";

export default function CastScriptLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.__onGCastApiAvailable = (isAvailable) => {
      if (isAvailable) {
        initCastSender();
      }
    };

    if (document.getElementById("cast-sender-sdk")) return;

    const script = document.createElement("script");
    script.id = "cast-sender-sdk";
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return null;
}
