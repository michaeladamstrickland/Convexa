import axios from 'axios';

export class DataTreeService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async searchProbateCases(county: string, startDate: string, endDate: string) {
    const response = await axios.get(`${this.baseUrl}/probate/search`, {
      headers: { 'apikey': this.apiKey },
      params: { county, startDate, endDate }
    });
    return response.data;
  }

  async getOwnershipHistory(apn: string) {
    const response = await axios.get(`${this.baseUrl}/ownership/history`, {
      headers: { 'apikey': this.apiKey },
      params: { apn }
    });
    return response.data;
  }
}
