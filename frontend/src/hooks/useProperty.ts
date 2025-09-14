import { useQuery } from "@tanstack/react-query";
import { propertyApi, PropertyDetail } from "../api/property";

export function useProperty(attomId?: string) {
  return useQuery<{ success?: boolean; data?: PropertyDetail } | PropertyDetail>({
    queryKey: ["property", attomId],
    queryFn: async () => propertyApi.getByAttomId(attomId!),
    enabled: !!attomId,
    select: (raw) => raw,
  });
}
