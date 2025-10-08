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
    // Ensure @ path alias resolves to project root (frontend directory)
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  }
}

module.exports = nextConfig