/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
// Derive repository name automatically in CI (GitHub) or via REPO_NAME, fallback to 'weatherly'
const repo = process.env.REPO_NAME
  || (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : null)
  || 'weatherly';

module.exports = {
  output: 'export',
  images: { unoptimized: true },
  assetPrefix: isProd ? `/${repo}/` : '',
  basePath: isProd ? `/${repo}` : '',
};
