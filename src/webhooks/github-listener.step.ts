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
    // FIX 1: Add 400 here so we are allowed to return it
    400: z.object({ status: z.string(), message: z.string() })
  }
};

// FIX 2: Remove the explicit type temporarily if you haven't updated types.d.ts yet
// changing Handlers['GithubWebhookListener'] to just 'any' or generic for now
// so you can run the code.
export const handler: any = async (req: any, { emit, logger }: any) => {
  const payload = githubPayloadSchema.safeParse(req.body);

  if (!payload.success) {
    logger.warn('⚠️ Invalid GitHub Payload', { errors: payload.error });
    return { status: 400, body: { status: 'error', message: 'Invalid payload' } };
  }

  const { workflow_job, repository } = payload.data;

  if (!workflow_job || workflow_job.status !== 'completed') {
    return { status: 200, body: { status: 'ignored (not completed)' } };
  }

  if (workflow_job.conclusion !== 'failure') {
    logger.info(`✅ Job passed: ${workflow_job.name}`);
    return { status: 200, body: { status: 'ignored (success)' } };
  }

  logger.error('🚨 CI FAILURE DETECTED! Initiating Autopsy...', { 
    repo: repository.full_name, 
    job: workflow_job.name,
    commit: workflow_job.head_sha
  });

  await emit({
    topic: 'start-autopsy',
    data: {
      repoName: repository.full_name,
      jobId: workflow_job.id,
      jobName: workflow_job.name,
      commitSha: workflow_job.head_sha,
      runUrl: workflow_job.run_url,
      timestamp: new Date().toISOString()
    }
  });

  return {
    status: 202,
    body: { status: 'triggered', message: 'Autopsy started.' }
  };
};