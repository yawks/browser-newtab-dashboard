export interface YoutrackConfig {
  baseUrl: string;
  apiEndpoint: string;
  authorizationHeader: string;
  issueFields: string;
  query: string;
  cacheDuration?: number;
}

export interface YoutrackIssue {
  id: string;
  idReadable?: string;
  created?: number;
  updated?: number;
  resolved?: number;
  reporter?: {
    email?: string;
  };
  updater?: {
    email?: string;
  };
  commentsCount?: number;
  tags?: Array<{
    name?: string;
  }>;
  customFields?: Array<{
    $type?: string;
    id?: string;
    projectCustomField?: {
      $type?: string;
      id?: string;
      field?: {
        $type?: string;
        id?: string;
        name?: string;
      };
    };
    value?: {
      $type?: string;
      name?: string;
      minutes?: number;
      presentation?: string;
    };
  }>;
  summary?: string;
  description?: string;
}

