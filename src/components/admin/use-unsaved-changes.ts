"use client";

import { useEffect } from "react";

const message = "Você tem alterações que ainda não foram salvas. Deseja sair mesmo assim?";

/** Warns before links or browser navigation discard a long editor draft. */
export function useUnsavedChanges(hasChanges: boolean) {
  useEffect(() => {
    if (!hasChanges) {
      return;
    }

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function beforeLinkNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      const link = target instanceof Element ? target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") {
        return;
      }
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeLinkNavigation, true);
    };
  }, [hasChanges]);
}

