import covers from "@/design/brand/v7/social-covers.json";

/** One route-to-cover map for OpenGraph and Twitter; all pictures built locally. */
export function brandSocialImage(route: string) {
  const cover = covers.find(item => item.route === route);
  if (!cover) throw new Error(`Missing branded social cover: ${route}`);
  return { url: `/brand/v7/social/${cover.id}.jpg`, width: 1200, height: 630, alt: cover.alt, type: "image/jpeg" };
}
