/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // Ensure static HTML files in /public are served as-is
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/landing.html',
      },
    ]
  },
}
module.exports = nextConfig
