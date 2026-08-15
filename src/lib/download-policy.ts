export function shouldCountDownload(opts: {
  headOnly: boolean;
  inline: boolean;
  range: { start: number } | null;
}): boolean {
  if (opts.headOnly || opts.inline) return false;
  if (opts.range && opts.range.start !== 0) return false;
  return true;
}
