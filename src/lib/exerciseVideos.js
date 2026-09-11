export function getVideoThumb(url = "") {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
  if (yt) return { thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${yt[1]}`, videoId: yt[1] };
  return null;
}
