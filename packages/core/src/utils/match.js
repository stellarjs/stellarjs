export default function match(url, pattern) {
  if (pattern === undefined) {
    return true;
  }

  return url.match(pattern);
}
