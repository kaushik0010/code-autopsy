import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const githubPayloadSchema = z.object({
  action: z.string().optional(),
  repository: z.object({
    full_name: z.string(),
    html_url: z.string()
  }),
  workflow_job: z.object({
    id: z.number(),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    head_sha: z.string(),
    run_url: z.string(),
    head_branch: z.string().optional(), // <--- ADDED THIS (Required for the loop fix)
  }).optional()
}).passthrough();

export const config: ApiRouteConfig = {
  name: 'GithubWebhookListener',
  type: 'api',
  path: '/webhooks/github',
  method: 'POST',
  description: 'Listens for GitHub Workflow failures',
  emits: ['start-autopsy'],
  flows: ['autopsy-flow'],
  responseSchema: {
    200: z.object({ status: z.string() }),
    202: z.object({ status: z.string(), message: z.string() }),
    400: z.object({ status: z.string(), message: z.string() })
  }
};

// @ts-ignore - bypassing strict types for hackathon speed
export const handler = async (event: any, { emit, logger }: any) => {
  const { headers, body } = event;
  const eventType = headers['x-github-event'];

  // 1. Acknowledge Ping events (GitHub sends these to test the connection)
  if (eventType === 'ping') {
    return { status: 200, body: { status: 'pong' } };
  }

  if (eventType === 'workflow_job') {
    const { workflow_job } = body;
    const branchName = workflow_job.head_branch;

    // 🛑 STOP THE LOOP: Ignore failures on branches we created
    if (branchName && branchName.includes('autopsy/')) {
      logger.info(`🚫 Ignoring failure on autopsy branch: ${branchName}. The Surgeon should not operate on itself.`);
      // IMPORTANT: Return 200 so GitHub knows we received it, even if we ignored it.
      return { status: 200, body: { status: 'ignored_autopsy_branch' } }; 
    }

    if (workflow_job.status === 'completed' && workflow_job.conclusion === 'failure') {
      logger.error(`🚨 CI FAILURE DETECTED! Initiating Autopsy...`);
      logger.info(`├ repo: ${body.repository.full_name}`);
      logger.info(`├ job: ${workflow_job.name}`);
      logger.info(`└ commit: ${workflow_job.head_sha}`);

      await emit({
        topic: 'start-autopsy',
        data: {
          repoName: body.repository.full_name,
          jobId: workflow_job.id,
          jobName: workflow_job.name,
          commitSha: workflow_job.head_sha,
          runUrl: workflow_job.html_url,
          timestamp: workflow_job.completed_at
        }
      });
      
      return { status: 200, body: { status: 'autopsy_started' } };
    }
  }

  // Default response for other events
  return { status: 200, body: { status: 'ignored' } };
};