/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => config,
  experimental: { turbo: false },
  turbopack: {},
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
}
module.exports = nextConfig
