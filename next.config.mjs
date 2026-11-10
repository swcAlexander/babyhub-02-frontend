/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/dmvl4lxnq/image/upload/**',
      },
    ],
  },
};

export default nextConfig;
