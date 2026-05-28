import { ReactNode } from "react";

export function MotionReveal({ children }: { children: ReactNode }) {
  return <div className="motion-safe:transition motion-safe:duration-200 motion-safe:ease-out">{children}</div>;
}
