export type Profile = {
  id: string;
  nickname: string;
};

export type Room = {
  id: string;
  code: string;
  owner_id: string;
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
