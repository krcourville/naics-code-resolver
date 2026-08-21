/** §V16: successful submit -> URL reflects the searched term, via replaceState (⊥ history spam). */
export function syncTermUrl(term: string): void {
  const params = new URLSearchParams(location.search);
  params.set("term", term);
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

export function clearTermUrl(): void {
  const params = new URLSearchParams(location.search);
  params.delete("term");
  history.replaceState(null, "", `${location.pathname}?${params}`);
}
