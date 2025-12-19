import type { EventConfig } from 'motia';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from '@octokit/rest';

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
  description: 'V2: Reads logs, fetches source code, and generates a fix',
  subscribes: ['analyze-logs'],
  emits: ['apply-fix'],
  flows: ['autopsy-flow'],
  input: inputSchema
};

// @ts-ignore
export const handler = async (input: any, { emit, logger, state }: any) => {
  const { failureLogs, repoName, commitSha, jobId } = input;
  const [owner, repo] = repoName.split('/');
  
  logger.info('🧠 V2 Analysis Started: Scouting for the broken file...');

  if (!process.env.GEMINI_API_KEY || !process.env.GITHUB_TOKEN) {
    throw new Error('Missing API Keys in .env');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  try {
    // --- PHASE 1: THE SCOUT (Identify the file) ---
    const scoutPrompt = `
      Analyze these CI/CD logs and identify the SPECIFIC file path that is causing the error.
      
      LOGS:
      ${failureLogs}

      Examples of what I want: 
      - "src/app.ts"
      - ".github/workflows/ci.yml"
      - "package.json"

      Return JSON only: { "filePath": "path/to/file" }
      If you cannot be 100% sure, make your best guess based on the error trace.
    `;

    const scoutResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: scoutPrompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const scoutData = JSON.parse(scoutResponse.text || "{}");
    const targetFile = scoutData.filePath;

    if (!targetFile) {
      throw new Error("AI could not identify the broken file path from logs.");
    }

    logger.info(`🔍 Scout identified suspect: ${targetFile}`);


    // --- PHASE 2: THE RETRIEVER (Fetch the code) ---
    let fileContent = "";
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: targetFile,
        ref: commitSha // Get the version exactly as it was when it failed
      });

      // GitHub returns content in base64
      if ('content' in data && typeof data.content === 'string') {
        fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
        logger.info(`📂 Retrieved file content (${fileContent.length} chars)`);
      }
    } catch (err) {
      logger.warn(`⚠️ Could not fetch file content for ${targetFile}. Proceeding with logs only.`);
    }


    // --- PHASE 3: THE SURGEON (Generate the fix) ---
    logger.info('🩺 Surgeon is analyzing code + logs...');
    
    const surgeonPrompt = `
      You are a Senior DevOps Engineer. I have a build failure.
      
      THE BROKEN FILE (${targetFile}):
      \`\`\`
      ${fileContent}
      \`\`\`

      THE ERROR LOGS:
      ${failureLogs}

      TASK:
      1. Analyze the relationship between the code and the error.
      2. Generate the FULL CORRECTED FILE CONTENT.
      
      RESPONSE FORMAT (Strict JSON):
      {
        "rootCause": "Explanation of the bug",
        "filePath": "${targetFile}",
        "suggestedFix": "THE FULL CORRECTED FILE CONTENT (Strings must be escaped properly)",
        "explanation": "Why this change fixes the bug"
      }
    `;

    const surgeonResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: surgeonPrompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const analysis = JSON.parse(surgeonResponse.text || "{}");

    logger.info('✅ V2 Diagnosis complete!', { cause: analysis.rootCause });

    // Save to state
    await state.set('autopsy-analysis', String(jobId), { ...analysis, v2: true });

    // Trigger Day 4: The Surgeon (PR Creator)
    await emit({
      topic: 'apply-fix',
      data: {
        ...input,
        analysis: analysis
      }
    });

    return { status: 'analyzed_v2', targetFile };

  } catch (error: any) {
    logger.error('Failed to analyze failure', { error: error.message });
    throw error;
  }
};