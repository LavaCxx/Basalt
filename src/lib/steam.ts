import type { SteamStatus, SteamGame } from './types';

interface SteamApiGame {
  appid: number;
  name: string;
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

const demoStatus: SteamStatus = {
  online: true,
  currentGameId: 632360,
  currentGameName: 'RimWorld',
};

export function getDemoSteamGames(): SteamGame[] {
  return demoGames;
}

interface SteamApiPlayer {
  personastate?: number;
  gameid?: string;
  gameextrainfo?: string;
  avatarmedium?: string;
}

let steamStatusCache: { data: SteamStatus; expiresAt: number } | null = null;

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
    .map((game) => ({
      id: game.appid,
      name: game.name,
      cover: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`,
      url: `https://store.steampowered.com/app/${game.appid}`,
      playtimeForeverMinutes: game.playtime_forever || 0,
      playtimeTwoWeeksMinutes: game.playtime_2weeks || 0,
    }));
}

export async function getSteamStatus(
  steamId: string | undefined,
  apiKey?: string
): Promise<SteamStatus> {
  if (!steamId || !apiKey) {
    return import.meta.env.DEV ? demoStatus : { online: false };
  }
  if (steamStatusCache && steamStatusCache.expiresAt > Date.now()) {
    return steamStatusCache.data;
  }

  const params = new URLSearchParams({
    key: apiKey,
    steamids: steamId,
    format: 'json',
  });
  const response = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Steam player API responded with ${response.status}`);

  const data = (await response.json()) as { response?: { players?: SteamApiPlayer[] } };
  const player = data.response?.players?.[0];
  const status: SteamStatus = {
    online: Boolean(player?.gameextrainfo || (player?.personastate && player.personastate > 0)),
    currentGameId: player?.gameid ? Number(player.gameid) : undefined,
    currentGameName: player?.gameextrainfo,
    avatar: player?.avatarmedium,
  };
  steamStatusCache = { data: status, expiresAt: Date.now() + 60_000 };
  return status;
}
