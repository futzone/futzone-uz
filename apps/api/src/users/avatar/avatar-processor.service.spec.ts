import type { ProcessAvatarJobPayload } from '@futzone/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarProcessorService } from './avatar-processor.service';
import { AvatarStorageService } from './avatar-storage.service';

describe('AvatarProcessorService', () => {
  it('is idempotent and never deletes the current processed avatar', async () => {
    const payload: ProcessAvatarJobPayload = { userId: 'user-1', objectKey: 'users/user-1/avatar-uploads/source', processedKey: 'users/user-1/avatars/new.webp' };
    const processedUrl = 'http://storage/bucket/users/user-1/avatars/new.webp';
    let state = { avatarUrl: 'http://storage/bucket/users/user-1/avatars/old.webp', avatarUploadKey: payload.objectKey as string | null };
    let previousAvatarKey: string | null = null;
    const transaction = { user: {
      updateMany: jest.fn(async () => { state = { avatarUrl: processedUrl, avatarUploadKey: null }; return { count: 1 }; }),
    }, avatarUpload: { update: jest.fn(async ({ data }: { data: { previousAvatarKey: string | null } }) => { previousAvatarKey = data.previousAvatarKey; return {}; }) } };
    const prismaMock = { user: {
      findUnique: jest.fn(async () => ({ ...state })),
    }, avatarUpload: { findUnique: jest.fn(async () => ({ previousAvatarKey })) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<void>) => callback(transaction)),
    };
    const deleted: string[] = [];
    const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const storageMock = {
      publicUrl: jest.fn(() => processedUrl), read: jest.fn(async () => onePixelPng), write: jest.fn(async () => undefined),
      delete: jest.fn(async (key: string) => { deleted.push(key); }), keyFromPublicUrl: jest.fn(() => 'users/user-1/avatars/old.webp'),
    };
    const processor = new AvatarProcessorService(prismaMock as unknown as PrismaService, storageMock as unknown as AvatarStorageService);
    await processor.process(payload);
    await processor.process(payload);
    expect(storageMock.write).toHaveBeenCalledTimes(1);
    expect(transaction.user.updateMany).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ avatarUrl: processedUrl, avatarUploadKey: null });
    expect(deleted).not.toContain(payload.processedKey);
    expect(deleted).toContain('users/user-1/avatars/old.webp');
  });
});
