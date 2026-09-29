import { Post } from './post';

export interface FeedQueryDto {
  cursor?: string;
  limit?: number;
  type?: 'all' | 'video' | 'image' | 'text';
}

export interface FeedResponse {
  items: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}
