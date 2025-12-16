import type { EventConfig } from 'motia';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

const inputSchema = z.object({
  repoName: z.string(),
  jobId: z.number(),
  jobName: z.string(),
  commitSha: z.string(),
  runUrl: z.string(),
  timestamp: z.string()
});

export const config: EventConfig = {
  name: 'FetchBuildLogs',
  type: 'event',
  description: 'Downloads and sanitizes logs from GitHub',
  subscribes: ['start-autopsy'],
  emits: ['analyze-logs'],
  flows: ['autopsy-flow'],
  input: inputSchema
};

// FIX: Removed "Handlers['FetchBuildLogs']" and used "any"
// This tells TypeScript: "Trust me, I know what I'm doing."
export const handler = async (input: any, { emit, logger, state }: any) => {
  const { repoName, jobId } = input;
  const [owner, repo] = repoName.split('/');

  logger.info(`Fetching logs for job ${jobId} in ${repoName}...`);

  // Ensure the token is present
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is missing in .env file');
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  try {
    // 1. Download the logs
    const response = await octokit.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: jobId,
    });

    // The data comes as a string (the raw log)
    const rawLog = String(response.data);

    // 2. Sanitize: Logs are huge. We only want the error.
    // Strategy: Take the last 200 lines.
    const lines = rawLog.split('\n');
    const failureSnippet = lines.slice(-200).join('\n');

    logger.info(`Log retrieved (${lines.length} lines). Snippet size: ${failureSnippet.length} chars.`);

    // 3. Persist to State
    await state.set('autopsy-logs', String(jobId), {
      fullLogLength: rawLog.length,
      snippet: failureSnippet,
      retrievedAt: new Date().toISOString()
    });

    // 4. Pass to the AI (Day 3)
    await emit({
      topic: 'analyze-logs',
      data: {
        ...input,
        failureLogs: failureSnippet
      }
    });

    return { status: 'success', logsLength: rawLog.length };

  } catch (error: any) {
    logger.error('Failed to fetch logs', { error: error.message });
    throw error;
  }
};