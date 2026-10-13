import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mazarstudio.com'; 
  const lastModified = new Date();

  // Define main public routes
  const routes = [
    '',
    '/mazar/about',
    '/mazar/book',
    '/mazar/units/studios',
    '/mazar/rules',
    '/mazar/how-to-book',
    '/social',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'daily' : 'weekly' as any,
    priority: route === '' ? 1 : 0.8,
  }));
}
