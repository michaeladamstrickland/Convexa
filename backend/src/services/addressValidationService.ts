import axios from 'axios';

export class AddressValidationService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateAddress(address: string) {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: this.apiKey }
    });
    return response.data;
  }
}
