import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchConsumableProducts, fetchSubscriptionProducts } from "./iap";

export function useStoreProducts(
  productIds: string[],
  type: "consumable" | "subscription"
) {
  const productKey = productIds.join("|");
  const stableProductIds = useMemo(
    () => productKey.split("|").filter(Boolean),
    [productKey]
  );
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [availableProductIds, setAvailableProductIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const retry = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    const result =
      type === "subscription"
        ? await fetchSubscriptionProducts(stableProductIds)
        : await fetchConsumableProducts(stableProductIds);
    setPrices(result.prices);
    setTitles(result.titles);
    setDurations(result.durations);
    setAvailableProductIds(result.availableProductIds);
    setError(result.error);
    setIsLoading(false);
  }, [stableProductIds, type]);

  useEffect(() => {
    retry();
  }, [retry]);

  return { prices, titles, durations, availableProductIds, isLoading, error, retry };
}
