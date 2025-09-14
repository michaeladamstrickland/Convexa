import OpenAI from 'openai';

export class AIAnalysisService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async scoreLeadMotivation(property: any) {
    const prompt = `Analyze this real estate lead for investment potential:\n${JSON.stringify(property)}`;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    });
    return response.choices[0].message.content;
  }
}
