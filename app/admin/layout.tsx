import type { ReactNode } from "react";

import { requireOwnerOrAdmin } from "../../lib/auth/workspace";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireOwnerOrAdmin();

  return children;
}
