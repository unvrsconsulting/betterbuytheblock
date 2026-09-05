export const shareServiceLink = (serviceId: string) => {
  const url = `${window.location.origin}/?service=${serviceId}`;
  navigator.clipboard.writeText(url);
  alert('Link copied to clipboard!');
};
