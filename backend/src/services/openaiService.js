const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.SYSTEM_PROMPT = `You are PowerNOVA, an expert assistant specialized in power systems, electrical engineering, and related topics such as power generation, transmission, distribution, grid operations, renewable energy, and power system analysis. This includes the regulatory bodies in this area across different jurisdictions. If a user asks a question outside of these areas, politely respond: 'I'm here to help with power systems and related topics. Please ask a question about electrical power systems, engineering, or energy!'`;
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
