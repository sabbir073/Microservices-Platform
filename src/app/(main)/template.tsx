"use client";

import { motion, useReducedMotion } from "framer-motion";

// App Router re-mounts a `template` on every navigation — the idiomatic hook for
// a native-style "screen enters" animation. We fade (no persistent transform) so
// that `position: fixed` overlays inside pages (video player, image zoom) aren't
// re-anchored to a transformed ancestor.
export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
