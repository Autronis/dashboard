"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ACTIONS,
  getShortcutsForRoute,
  type ActionContext,
  type ActionDef,
  type ActionId,
} from "@/components/layout/action-registry";
import { useToast } from "@/hooks/use-toast";

export interface BoundAction extends ActionDef {
  run: () => void;
}

/**
 * Resolve the current route's shortcuts and all actions, pre-bound to a
 * router + toast context. Consumers get a `run()` function per action.
 */
export function useActionShortcuts() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const addToast = useToast((s) => s.addToast);

  const bound = useMemo(() => {
    const ctx: ActionContext = {
      router,
      pathname,
      openCommandPalette: () => {
        window.dispatchEvent(new CustomEvent("autronis:open-command-palette"));
      },
      addToast,
    };

    const bindOne = (def: ActionDef): BoundAction => ({
      ...def,
      run: () => def.handler(ctx),
    });

    const visibleIds = getShortcutsForRoute(pathname);
    const visible = visibleIds.map((id) => bindOne(ACTIONS[id]));
    const allIds = Object.keys(ACTIONS) as ActionId[];
    const all = allIds.map((id) => bindOne(ACTIONS[id]));

    return { visible, all };
  }, [pathname, router, addToast]);

  return bound;
}
