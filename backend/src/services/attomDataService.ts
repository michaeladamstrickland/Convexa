import axios from 'axios';

export class AttomDataService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getPropertyDetails(address: string) {
    const response = await axios.get(`${this.baseUrl}/property/detail`, {
      headers: { 'apikey': this.apiKey },
      params: { address }
    });
    return response.data;
  }

  async getOwnerInfo(propertyId: string) {
    const response = await axios.get(`${this.baseUrl}/owner/detail`, {
      headers: { 'apikey': this.apiKey },
      params: { propertyId }
    });
    return response.data;
  }
}
