import { useLocale } from "@lib/hooks/useLocale";

import { HeadSeo } from "@components/seo/head-seo";

export default function Custom404() {
  const { t } = useLocale();

  return (
    <>
      <HeadSeo
        title={t("404_page_not_found")}
        description={t("404_page_not_found")}
        nextSeoProps={{
          nofollow: true,
          noindex: true,
        }}
      />
      <main className="min-h-screen text-center flex flex-col items-center justify-center">
        <div className="flex items-center justify-center">
          <h1 className="font-medium text-2xl py-2 pr-6 mr-6 border border-l-0 border-t-0 border-b-0 border-gray-400 inline-block">
            404
          </h1>
          <div className="inline-block">
            <h2 className="text-md">This page could not be found.</h2>
          </div>
        </div>
      </main>
    </>
  );
}
