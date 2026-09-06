// Correct this known provider alias without rearranging other players' names.
export function playerDisplayName(name: string): string {
  const alias = name.trim().replace(/\s+/g, ' ');
  return alias === 'M. Etcheverry T.' ? 'T. Etcheverry' : name;
}
