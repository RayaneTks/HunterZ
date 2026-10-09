import type { NextConfig } from 'next';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type ReleaseEntry = { id: string; title: string; date: string };
type ReleaseInfo = {
  deploymentId: string;
  commit: string;
  title: string;
  builtAt: string;
  target: string;
  url: string | null;
  isVercelDeployment: boolean;
  history: ReleaseEntry[];
};

let history: ReleaseEntry[] = [];
try {
  const log = execFileSync('git', ['log', '-10', '--format=%H%x1f%s%x1f%cI'], { encoding: 'utf8' });
  history = log.split('\n').filter(Boolean).map((line) => {
    const [id, title, date] = line.split('\x1f');
    return { id, title, date };
  });
} catch {
  // The build can still publish a single release when a Git checkout is unavailable.
}

const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? history[0]?.id ?? 'local';
const commitTitle = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? history.find((entry) => entry.id === commit)?.title ?? 'Mise à jour de HUNT';
const builtAt = new Date().toISOString();
const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const releaseInfo: ReleaseInfo = {
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL ?? commit,
  commit,
  title: commitTitle.split('\n')[0].trim(),
  builtAt,
  target: process.env.VERCEL_ENV ?? 'local',
  url: deploymentUrl,
  isVercelDeployment: process.env.VERCEL === '1',
  history: history.length ? history : [{ id: commit, title: commitTitle.split('\n')[0].trim(), date: builtAt }],
};

writeFileSync(join(process.cwd(), 'public', 'release.json'), JSON.stringify(releaseInfo));

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_RELEASE_INFO: JSON.stringify(releaseInfo),
  },
};

export default nextConfig;
