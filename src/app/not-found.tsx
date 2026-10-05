import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-sm font-semibold">Not found</h1>
      <p className="max-w-md text-xs text-muted-foreground">
        That page or category does not exist. It may have been deleted.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/today">Back to Today</Link>
      </Button>
    </div>
  );
}
