import type { NextConfig } from 'next';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type ReleaseInfo = {
  deploymentId: string;
  releaseTitle: string;
  notes: string[];
  builtAt: string;
  target: string;
  url: string | null;
  isVercelDeployment: boolean;
};

let commitMessage = '';
try {
  commitMessage = execFileSync('git', ['show', '-s', '--format=%B', 'HEAD'], { encoding: 'utf8' });
} catch {
  // Local builds can still run without a Git checkout.
}

const declaredReleaseTitle = commitMessage.match(/^Release-Title:\s*(.+)$/m)?.[1]?.trim();
const notes = [...commitMessage.matchAll(/^Release-Note:\s*(.+)$/gm)].map((match) => match[1].trim());
if (process.env.VERCEL_ENV === 'production' && (!declaredReleaseTitle || notes.length === 0)) {
  throw new Error('Les builds Production doivent contenir Release-Title et au moins une Release-Note destinés aux joueurs.');
}
const releaseTitle = declaredReleaseTitle ?? 'HUNT a reçu une mise à jour';
const builtAt = new Date().toISOString();
const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const releaseInfo: ReleaseInfo = {
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
  releaseTitle,
  notes: notes.length ? notes : ['Cette mise à jour apporte des améliorations et corrections à HUNT.'],
  builtAt,
  target: process.env.VERCEL_ENV ?? 'local',
  url: deploymentUrl,
  isVercelDeployment: process.env.VERCEL === '1',
};

writeFileSync(join(process.cwd(), 'public', 'release.json'), JSON.stringify(releaseInfo));

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_RELEASE_INFO: JSON.stringify(releaseInfo),
  },
};

export default nextConfig;
