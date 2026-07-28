"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeRequirementQuestion } from "@/actions/booking-requirements";
import { Button } from "@/components/ui/button";

export function RemoveRequirementQuestionButton({ id }: { id: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={removing}
        onClick={async () => {
          setRemoving(true);
          setError(null);
          try {
            await removeRequirementQuestion(id);
            router.refresh();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not remove this question.");
            setRemoving(false);
          }
        }}
      >
        {removing ? "Removing…" : "Remove"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
