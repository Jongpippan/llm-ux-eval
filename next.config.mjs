/** @type {import('next').NextConfig} */

// 정적 export 모드(GitHub Pages 등 human 원격 수집용)는 NEXT_PUBLIC_STATIC_EXPORT=1 일 때만 켠다.
// 로컬 개발/LLM 시뮬레이션(API route + 서버 로그)은 이 플래그 없이 기존대로 동작한다.
const isStatic = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
// GitHub Pages project site(서브경로) 배포 시 `/<repo>` 로 지정. 루트(user page/커스텀 도메인)면 빈 값.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export", // out/ 정적 빌드 (API route 는 build:static 이 빌드에서 제외)
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        trailingSlash: true, // GH Pages 가 /route/index.html 을 바로 서빙하도록
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
