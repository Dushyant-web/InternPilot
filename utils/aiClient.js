const { GoogleGenAI } = require('@google/genai');

/**
 * Shared AI Client for Issue #146 (Mock Interview & Problem Generator)
 * Provides schema validation and a 1-attempt repair/retry mechanism.
 */
class AIClient {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (this.apiKey) {
            this.client = new GoogleGenAI({ apiKey: this.apiKey });
        }
        this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.fallbackModel = 'gemini-2.5-flash';
    }

    isTransientError(err) {
        return err.status === 503 || (err.message && /high demand|temporar|503|overloaded/i.test(err.message));
    }

    /**
     * Generates structured JSON adhering to the provided responseSchema.
     * Includes exactly 1 repair/retry attempt if parsing fails or fields are missing.
     */
    async generateJsonWithRetry(prompt, responseSchema, requiredFields = [], attempt = 1, previousError = null) {
        if (!this.client) {
            throw new Error('GEMINI_API_KEY is not configured in environment variables.');
        }

        let modelToUse = this.defaultModel;
        
        let finalPrompt = prompt;
        if (attempt > 1 && previousError) {
            finalPrompt = `${prompt}\n\nIMPORTANT: Your previous response was invalid. Error: ${previousError}. Please ensure you return valid JSON matching the exact schema.`;
        }

        try {
            const response = await this.client.models.generateContent({
                model: modelToUse,
                contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });

            const parsed = JSON.parse(response.text);

            // Strict Validation
            if (requiredFields.length > 0) {
                for (const field of requiredFields) {
                    if (parsed[field] === undefined || parsed[field] === null || parsed[field] === '') {
                        throw new Error(`Missing required field: ${field}`);
                    }
                }
            }

            return parsed;

        } catch (err) {
            // Handle 503 Fallback natively on attempt 1
            if (attempt === 1 && this.isTransientError(err)) {
                console.warn(`[AIClient] ${modelToUse} is experiencing high demand. Failing over to ${this.fallbackModel}...`);
                try {
                    const fallbackResponse = await this.client.models.generateContent({
                        model: this.fallbackModel,
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: responseSchema
                        }
                    });
                    const parsedFallback = JSON.parse(fallbackResponse.text);
                    for (const field of requiredFields) {
                        if (parsedFallback[field] === undefined || parsedFallback[field] === null || parsedFallback[field] === '') {
                            throw new Error(`Missing required field: ${field}`);
                        }
                    }
                    return parsedFallback;
                } catch (fallbackErr) {
                    // If fallback also fails structurally, do the 1 retry
                    if (fallbackErr.name === 'SyntaxError' || fallbackErr.message.includes('Missing required field')) {
                        return this.generateJsonWithRetry(prompt, responseSchema, requiredFields, 2, fallbackErr.message);
                    }
                    throw fallbackErr;
                }
            }

            // Repair/Retry for validation or parse errors
            if (attempt === 1 && (err.name === 'SyntaxError' || err.message.includes('Missing required field'))) {
                console.warn(`[AIClient] Validation failed, triggering repair retry. Error: ${err.message}`);
                return this.generateJsonWithRetry(prompt, responseSchema, requiredFields, 2, err.message);
            }

            throw err;
        }
    }
}

module.exports = new AIClient();
