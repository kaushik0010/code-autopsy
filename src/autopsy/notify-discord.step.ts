import type { EventConfig } from 'motia';
import { z } from 'zod';

const inputSchema = z.object({
  repoName: z.string(),
  jobId: z.number(),
  prUrl: z.string(), // This is now required
  analysis: z.object({
    rootCause: z.string(),
    filePath: z.string()
  })
});

export const config: EventConfig = {
  name: 'NotifyDiscord',
  type: 'event',
  description: 'Sends a rich notification card to Discord',
  subscribes: ['pr-created'], // <--- NEW: Listens for the success signal
  emits: [], 
  flows: ['autopsy-flow'],
  input: inputSchema
};

// @ts-ignore
export const handler = async (input: any, { logger }: any) => {
  const { repoName, prUrl, analysis } = input;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn('Skipping Discord notification (Missing URL in .env)');
    return;
  }

  logger.info('📢 Broadcasting to Discord...');

  const payload = {
    username: "CodeAutopsy Agent",
    avatar_url: "https://i.imgur.com/4h7mFM2.png",
    embeds: [
      {
        title: "🚨 Autopsy Complete: Fix Deployed",
        description: "The AI Surgeon has analyzed the failure and opened a Pull Request.",
        color: 5763719, // Green
        fields: [
          { name: "Repository", value: repoName, inline: true },
          { name: "Broken File", value: `\`${analysis.filePath}\``, inline: true },
          { name: "Diagnosis", value: analysis.rootCause.substring(0, 1024) }, // Discord limit
          { name: "Action", value: `👉 [**Review & Merge PR**](${prUrl})` }
        ],
        footer: { text: "Self-Healing CI/CD Agent • V2.0" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
       logger.error(`Discord API returned ${res.status}: ${res.statusText}`);
    } else {
       logger.info('✅ Notification sent!');
    }
    
    return { status: 'sent' };

  } catch (error: any) {
    logger.error('Failed to send Discord notification', { error: error.message });
  }
};