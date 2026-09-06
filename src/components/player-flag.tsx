import { playerCountry } from '@/lib/player-country';

export function PlayerFlag({ country }: { country?: string }) {
  const resolved = playerCountry(country);
  return resolved ? <span className="player-flag" role="img" aria-label={resolved.name} title={resolved.name}>{resolved.flag}</span> : null;
}
