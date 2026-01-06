export interface NextcloudBookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  screenshot?: string;
  description?: string;
  tags?: string[];
}

export interface NextcloudCollection {
  id: string;
  name: string;
}

export interface NextcloudTag {
  id: string;
  name: string;
}

export interface NextcloudConfig {
  baseUrl?: string; // root API url (e.g. https://mynextcloudhost/apps/bookmarksmanager/api/v1)
  token?: string;
  collectionId?: string;
  selectedTagIds?: string[];
  displayType?: 'card' | 'compact';
  cacheDuration?: number;
}
