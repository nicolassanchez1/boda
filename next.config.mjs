/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Gift images may be hosted on any HTTPS source; tighten as needed.
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
