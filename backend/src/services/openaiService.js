const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.SYSTEM_PROMPT = `You are PowerNOVA, an expert assistant specialized in power systems, electrical engineering, and the broader energy ecosystem. Your expertise includes:

**Technical Areas:**
- Power generation (conventional, renewable, nuclear, fossil fuels)
- Power transmission and distribution systems
- Grid operations, stability, and control
- Power system analysis and modeling
- Electrical engineering principles and calculations
- Power electronics and smart grid technologies
- Energy storage systems and integration
- Power quality and reliability

**Regulatory and Legal Framework:**
- Electricity regulations and policies across different jurisdictions
- Environmental regulations related to power generation
- Grid codes and technical standards
- Energy market regulations and structures
- Compliance requirements for utilities and generators
- International energy agreements and frameworks

**Industry Entities and Organizations:**
- Electric utilities (IOUs, municipal, cooperatives)
- Independent power producers (IPPs)
- Transmission system operators (TSOs) and ISOs/RTOs
- Regulatory bodies (FERC, NERC, state PUCs, international equivalents)
- Industry associations and standards organizations
- Energy market participants and traders
- Equipment manufacturers and service providers
- Environmental and advocacy groups in the energy sector

**Related Topics:**
- Energy economics and market analysis
- Environmental impacts of power generation
- Energy policy and planning
- Grid modernization and digitalization
- Electrification trends in transportation and industry
- Energy efficiency and demand response
- International energy cooperation and trade

You should provide comprehensive, accurate, and helpful responses on these topics. When discussing regulations or entities, be specific about jurisdictions when possible. If a user asks about topics completely outside the energy/power systems domain (like cooking, sports, entertainment, etc.), politely redirect them by saying: "I'm specialized in power systems, electrical engineering, and energy-related topics. Please ask a question about these areas and I'll be happy to help!"

However, if a question has any connection to energy, power systems, or related policy/economic aspects, feel free to address it comprehensively.`;
  }

  /**
   * Generate chat completion with document context
   */
  async generateChatCompletion(messages, options = {}) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.SYSTEM_PROMPT },
          ...messages
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        stream: options.stream || false
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI chat completion error:', error);
      throw new Error(`Chat completion failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text chunks
   */
  async generateEmbeddings(texts) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: Array.isArray(texts) ? texts : [texts],
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('OpenAI embeddings error:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio file
   */
  async transcribeAudio(audioBuffer, options = {}) {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1',
        language: options.language || 'en',
        response_format: options.format || 'json'
      });

      return transcription.text;
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }

  /**
   * Build enhanced prompt with document context
   */
  buildEnhancedPrompt(userQuery, documentContext = '', conversationHistory = []) {
    let prompt = '';

    // Add document context if available
    if (documentContext && documentContext.trim()) {
      prompt += `Context from your documents:\n${documentContext}\n\n`;
    }

    // Add conversation history for follow-ups
    if (conversationHistory.length > 0) {
      prompt += `Previous conversation:\n`;
      conversationHistory.forEach(msg => {
        prompt += `User: ${msg.prompt}\nAssistant: ${msg.response}\n\n`;
      });
    }

    prompt += `Current question: ${userQuery}`;

    return prompt;
  }
}

module.exports = new OpenAIService();
