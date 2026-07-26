import type { PublicProfile } from '@futzone/contracts';
import { ApiClient, ApiClientError } from './api';

type PublicProfileClient = Pick<ApiClient, 'publicProfile'>;

export async function loadPublicProfile(
  username: string,
  locale: string,
  client: PublicProfileClient,
  commentsPage = 1,
): Promise<PublicProfile | null> {
  try {
    return await client.publicProfile(username, locale, commentsPage, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

export async function loadPublicProfileMetadata(
  username: string,
  locale: string,
  client: PublicProfileClient,
): Promise<PublicProfile | null> {
  try {
    return await client.publicProfile(username, locale, 1, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}
