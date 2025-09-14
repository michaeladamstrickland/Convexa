import api from './client';

export interface PropertyDetail {
  attomId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName?: string;
  estimatedValue?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  // ...extend as backend provides
}

export const propertyApi = {
  getByAttomId: async (attomId: string): Promise<{ success: boolean; data: PropertyDetail } | PropertyDetail> => {
    const res = await api.get(`/attom/property/${attomId}/detail`);
    return res.data;
  },
};
