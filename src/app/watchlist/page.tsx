import WatchlistManager from "@/components/WatchlistManager";

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-100">Watchlist</h1>
      <WatchlistManager />
    </div>
  );
}
