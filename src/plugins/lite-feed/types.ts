export interface LiteFeedConfig {
  serverUrl: string;
  apiKey: string;
  status?: 'READ' | 'UNREAD' | '';
  type?: string;
  excludeType?: string;
  maxResults: number;
  cacheDuration?: number;
}

export interface LiteFeedEvent {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  image: string | null;
  status: string;
  type: string;
  pub_date: string;
}
