import { Skeleton } from "@/components/ui/skeleton";

/** Loading state: a calm placeholder that matches the task list layout. */
export default function AppLoading() {
  return (
    <div className="px-4 py-5 sm:px-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-4 h-11 w-full" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-md px-2 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: `${40 + index * 6}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
