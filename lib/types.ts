export type Profile = {
  id: string;
  nickname: string;
};

export type Room = {
  id: string;
  code: string;
  owner_id: string | null;
  zone_center_lat?: number | null;
  zone_center_lng?: number | null;
  zone_radius_m?: number | null;
  zone_available?: boolean;
};

export type HuntZone = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type Member = {
  user_id: string;
  profiles: { nickname: string } | null;
};

export type PlayerLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
  nickname: string;
};

export type LobbySnapshot = {
  members: Member[];
  locations: PlayerLocation[];
};
