export function escapeUrl(url) {
  // These chars are tested with curl+spawn
  const dangerousChars = {
    '[': '%5B',
    ']': '%5D',
    '{': '%7B',
    '}': '%7D',
    ' ': '%20',
    '\r': '%0D',
    '\n': '%0A',
    '\t': '%09',
    '\b': '%08',
    '\f': '%0C',
  };
  let newUrl = '';
  for (let c of url) {
    c = dangerousChars[c] || c;
    newUrl += c;
  }
  url = newUrl;

  return url;
}
