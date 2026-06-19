type Str = string;
type usize = number;

export function cStringByteLength(text: Str): usize {
  return new TextEncoder().encode(text).length + 1;
}
