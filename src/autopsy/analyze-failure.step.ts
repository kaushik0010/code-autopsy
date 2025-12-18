import type { EventConfig } from 'motia';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const inputSchema = z.object({
  repoName: z.string(),
  jobId: z.number(),
  jobName: z.string(),
  commitSha: z.string(),
  runUrl: z.string(),
  timestamp: z.string(),
  failureLogs: z.string() 
});

export const config: EventConfig = {
  name: 'AnalyzeFailure',
  type: 'event',
  description: 'Analyzes logs using Gemini to find root cause and fix',
  subscribes: ['analyze-logs'], 
  emits: ['apply-fix'],         
  flows: ['autopsy-flow'],
  input: inputSchema
};

// @ts-ignore - bypassing strict types
export const handler = async (input: any, { emit, logger, state }: any) => {
  const { failureLogs, repoName } = input;
  
  logger.info('🧠 Consulting the Oracle (Gemini)...');

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing in .env');
  }

  // Initialize the new client
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
    You are a Senior DevOps Engineer. 
    Analyze the following CI/CD build failure log from the repository '${repoName}'.
    
    FAILURE LOGS:
    ${failureLogs}

    TASK:
    1. Identify the root cause.
    2. Provide the specific file path that likely needs fixing.
    3. Generate the FULL CORRECTED FILE CONTENT. 
       (Do not just provide a snippet. Provide the entire file so I can overwrite it directly).
    
    RESPONSE FORMAT (Strict JSON):
    {
      "rootCause": "Short explanation",
      "filePath": "path/to/file (e.g. .github/workflows/ci-fail.yml)",
      "suggestedFix": "THE FULL FILE CONTENT HERE (escape newlines properly)",
      "explanation": "Why this fixes the issue"
    }
    
    Do not include markdown formatting (like \`\`\`json) in the response, just raw JSON.
  `;

  try {
    // New SDK Call Syntax
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using stable flash model
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        responseMimeType: "application/json", // Force JSON mode (Gemini specific feature)
      }
    });

    // The new SDK handles the text extraction slightly differently
    const responseText = response.text || ""; 

    if (!responseText) {
      logger.warn('Gemini returned no text. Full response:', response);
      throw new Error("Received empty response from Gemini");
    }
    
    // Clean up just in case
    const cleanJson = responseText?.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!cleanJson) throw new Error("Received empty response from Gemini");

    const analysis = JSON.parse(cleanJson);

    logger.info('✅ Diagnosis complete!', { 
      cause: analysis.rootCause,
      fix: analysis.suggestedFix 
    });

    // Save to state
    await state.set('autopsy-analysis', String(input.jobId), {
      ...analysis,
      analyzedAt: new Date().toISOString()
    });

    // Trigger Day 4: The Surgeon
    await emit({
      topic: 'apply-fix',
      data: {
        ...input,
        analysis: analysis
      }
    });

    return { status: 'analyzed', analysis };

  } catch (error: any) {
    logger.error('Failed to analyze failure', { error: error.message });
    throw error;
  }
};