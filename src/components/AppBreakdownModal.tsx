"use client";

import { Modal } from "@/components/Modal";
import { AppBreakdownList } from "@/components/AppBreakdownList";
import type { AppActivity } from "@/lib/types";

export function AppBreakdownModal({
  title,
  apps,
  onClose,
}: {
  title: string;
  apps: AppActivity[];
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <AppBreakdownList apps={apps} />
    </Modal>
  );
}
