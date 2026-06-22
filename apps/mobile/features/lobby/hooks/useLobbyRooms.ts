import { useCallback, useEffect, useRef, useState } from "react";
import { listPublicRooms, type ListPublicRoomsOptions, type RoomMeta } from "@/lib/api";

const REFRESH_INTERVAL_MS = 10_000;
const PAGE_LIMIT = 20;

export interface UseLobbyRoomsResult {
  rooms: RoomMeta[];
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useLobbyRooms(): UseLobbyRoomsResult {
  const [rooms, setRooms] = useState<RoomMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const inFlightRef = useRef(false);

  const fetchPage = useCallback(async (page: number, append: boolean): Promise<void> => {
    const options: ListPublicRoomsOptions = { page, limit: PAGE_LIMIT };
    try {
      const { rooms: fetched, total: fetchedTotal } = await listPublicRooms(options);
      setRooms((prev) => (append ? [...prev, ...fetched] : fetched));
      setTotal(fetchedTotal);
      setHasMore(fetched.length > 0 && page * PAGE_LIMIT < fetchedTotal);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load the lobby.";
      setError(message);
      if (!append) setRooms([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    pageRef.current = 1;
    await fetchPage(1, false);
    setIsRefreshing(false);
    setIsLoading(false);
    inFlightRef.current = false;
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;
    inFlightRef.current = true;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    await fetchPage(nextPage, true);
    pageRef.current = nextPage;
    setIsLoadingMore(false);
    inFlightRef.current = false;
  }, [fetchPage, hasMore]);

  useEffect(() => {
    let mounted = true;
    refresh().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    rooms,
    total,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
