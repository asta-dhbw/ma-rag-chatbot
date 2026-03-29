/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@zilliz/milvus2-sdk-node',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],
};

export default nextConfig;
