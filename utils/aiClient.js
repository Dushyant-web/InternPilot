const { GoogleGenAI } = require('@google/genai');
const cache = require('./cache');

// How long generateJsonCached reuses an answer.
const AI_CACHE_SECONDS = 24 * 60 * 60;

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
        this.defaultModel = 'gemini-2.5-flash';
        this.fallbackModel = 'gemini-2.5-flash';
        this.cache = cache;
    }

    getClient() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return null;
        }
        if (!this.client || this.apiKey !== apiKey) {
            this.apiKey = apiKey;
            this.client = new GoogleGenAI({ apiKey });
        }
        return this.client;
    }

    isTransientError(err) {
        return err && (err.status === 503 || (err.message && /high demand|temporar|503|overloaded/i.test(err.message)));
    }

    /**
     * Generates structured JSON adhering to the provided responseSchema.
     * Includes exactly 1 repair/retry attempt if parsing fails or fields are missing.
     */
    async generateJsonWithRetry(prompt, responseSchema, requiredFields = [], attempt = 1, previousError = null) {
        const client = this.getClient();
        if (!client) {
            throw new Error('GEMINI_API_KEY is not configured in environment variables.');
        }

        const modelToUse = process.env.GEMINI_MODEL || this.defaultModel;
        const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || this.fallbackModel;
        
        let finalPrompt = prompt;
        if (attempt > 1 && previousError) {
            finalPrompt = `${prompt}\n\nIMPORTANT: Your previous response was invalid. Error: ${previousError}. Please ensure you return valid JSON matching the exact schema.`;
        }

        try {
            const response = await client.models.generateContent({
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
                console.warn(`[AIClient] ${modelToUse} is experiencing high demand. Failing over to ${fallbackModel}...`);
                try {
                    const fallbackResponse = await client.models.generateContent({
                        model: fallbackModel,
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
                    if (fallbackErr.name === 'SyntaxError' || (fallbackErr.message && fallbackErr.message.includes('Missing required field'))) {
                        return this.generateJsonWithRetry(prompt, responseSchema, requiredFields, 2, fallbackErr.message);
                    }
                    throw fallbackErr;
                }
            }

            // Repair/Retry for validation or parse errors
            if (attempt === 1 && (err.name === 'SyntaxError' || (err.message && err.message.includes('Missing required field')))) {
                console.warn(`[AIClient] Validation failed, triggering repair retry. Error: ${err.message}`);
                return this.generateJsonWithRetry(prompt, responseSchema, requiredFields, 2, err.message);
            }

            throw err;
        }
    }

    /**
     * generateJsonWithRetry, reusing the answer for the same model, prompt and schema for a day.
     * Only for calls whose answer can't change for the same input, such as extracting data from
     * a resume; interview turns and new problem sets should stay fresh. Failed calls are never
     * cached, and keys are hashes, so no prompt text ends up in key names.
     */
    async generateJsonCached(prompt, responseSchema, requiredFields = [], { ttlSeconds = AI_CACHE_SECONDS } = {}) {
        const model = process.env.GEMINI_MODEL || this.defaultModel;
        const key = `ai:${cache.hashKey(model, prompt, responseSchema, requiredFields)}`;
        return this.cache.getOrSet(key, ttlSeconds, () => this.generateJsonWithRetry(prompt, responseSchema, requiredFields));
    }
}

module.exports = new AIClient();
