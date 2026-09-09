// Takes the service's real path (see services/seo/pageContent.js#servicePath)
// so the copied link is an actual bookmarkable/indexable page, not a dead
// "/?service=<id>" query param the app never reads.
export const shareServiceLink = (path: string) => {
  const url = `${window.location.origin}${path}`;
  navigator.clipboard.writeText(url);
  alert('Link copied to clipboard!');
};
