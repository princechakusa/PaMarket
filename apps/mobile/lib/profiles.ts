export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  verified: boolean | null;
  bio: string | null;
  city: string | null;
  created_at: string;
  last_seen?: string | null;
};
