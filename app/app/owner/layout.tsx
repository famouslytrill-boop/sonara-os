import type { ReactNode } from "react";

import { requireOwnerOrAdmin } from "../../../lib/auth/workspace";

export default async function AppOwnerLayout({ children }: { children: ReactNode }) {
  await requireOwnerOrAdmin();

  return children;
}
