import type { SteamGame } from './types';

interface SteamApiGame {
  appid: number;
  name: string;
  img_logo_url?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
}

const demoGames: SteamGame[] = [
  {
    id: 632360,
    name: 'RimWorld',
    cover: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/632360/header.jpg',
    url: 'https://store.steampowered.com/app/632360',
    playtimeForeverMinutes: 18320,
    playtimeTwoWeeksMinutes: 435,
  },
  {
    id: 427520,
    name: 'Factorio',
    cover: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/427520/header.jpg',
    url: 'https://store.steampowered.com/app/427520',
    playtimeForeverMinutes: 9160,
    playtimeTwoWeeksMinutes: 90,
  },
];

export function getDemoSteamGames(): SteamGame[] {
  return demoGames;
}

export async function getSteamGames(
  steamId: string | undefined,
  apiKey?: string
): Promise<SteamGame[]> {
  if (!steamId) {
    return import.meta.env.DEV ? demoGames : [];
  }

  const params = new URLSearchParams({
    steamid: steamId,
    format: 'json',
  });
  if (apiKey) {
    params.set('key', apiKey);
  }

  const response = await fetch(
    `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Steam API responded with ${response.status}`);

  const data = (await response.json()) as { response?: { games?: SteamApiGame[] } };
  return (data.response?.games || [])
    .slice(0, 3)
    .filter((game) => game.img_logo_url)
    .map((game) => ({
      id: game.appid,
      name: game.name,
      cover: `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_logo_url}.jpg`,
      url: `https://store.steampowered.com/app/${game.appid}`,
      playtimeForeverMinutes: game.playtime_forever || 0,
      playtimeTwoWeeksMinutes: game.playtime_2weeks || 0,
    }));
}
