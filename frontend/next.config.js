/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Remove output: 'export' for Vercel deployment
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  webpack: (config) => {
    // Ensure aliases resolve correctly in Vercel build
    config.resolve.alias['@'] = path.resolve(__dirname)
    config.resolve.alias['lib'] = path.resolve(__dirname, 'lib')
    config.resolve.alias['components'] = path.resolve(__dirname, 'components')
    return config
  }
}

module.exports = nextConfig
