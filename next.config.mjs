/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Gift images may be hosted on any HTTPS source; tighten as needed.
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      // Backward-compat for the old cryptic links. The guest route now lives at
      // /invitacion/{nombre}-{token}; a bare token still resolves (the page
      // takes the token from the last dash-group).
      { source: '/i/:token', destination: '/invitacion/:token', permanent: false },
    ];
  },
};

export default nextConfig;
