/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Memblokir iframe
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none';", // Proteksi tambahan
          },
        ],
      },
    ];
  },
};

export default nextConfig;
