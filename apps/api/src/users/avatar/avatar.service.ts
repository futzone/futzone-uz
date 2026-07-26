import { HttpStatus, Injectable } from '@nestjs/common';
import type { AvatarPresignResponse } from '@futzone/contracts';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_URL_TTL_SECONDS, MAX_AVATAR_BYTES } from './avatar.constants';
import { sniffAvatarImageType } from './avatar-file-type';
import { AvatarQueueService } from './avatar-queue.service';
import { AvatarStorageService } from './avatar-storage.service';
import { AvatarOwnershipPolicy } from './avatar-ownership.policy';

@Injectable()
export class AvatarService {
  public constructor(private readonly prisma: PrismaService, private readonly storage: AvatarStorageService, private readonly queue: AvatarQueueService, private readonly ownership: AvatarOwnershipPolicy) {}
  public async presign(userId: string, size: number): Promise<AvatarPresignResponse> {
    if (size > MAX_AVATAR_BYTES) throw new AppException('VALIDATION_ERROR', 'Avatar exceeds 5 MB', HttpStatus.BAD_REQUEST);
    const uploadId = uuidv7();
    const objectKey = `users/${userId}/avatar-uploads/${uploadId}`;
    const processedKey = `users/${userId}/avatars/${uploadId}.webp`;
    await this.prisma.avatarUpload.create({ data: { id: uploadId, userId, objectKey, processedKey, expectedSize: size } });
    const uploadUrl = await this.storage.presignPut(objectKey, size);
    return { uploadUrl, objectKey, expiresAt: new Date(Date.now() + AVATAR_URL_TTL_SECONDS * 1_000).toISOString() };
  }
  public async complete(userId: string, objectKey: string): Promise<{ accepted: true }> {
    this.ownership.assertObjectBelongsToUser(userId, objectKey);
    const upload = await this.prisma.avatarUpload.findFirst({ where: { objectKey, userId } });
    if (!upload) throw new AppException('NOT_FOUND', 'Avatar upload was not issued by the server', HttpStatus.NOT_FOUND);
    if (upload.status === 'COMPLETED') return { accepted: true };
    let size: number;
    let prefix: Uint8Array;
    try { ({ size } = await this.storage.metadata(objectKey)); prefix = await this.storage.prefix(objectKey); }
    catch { throw new AppException('NOT_FOUND', 'Uploaded avatar was not found', HttpStatus.NOT_FOUND); }
    if (size <= 0 || size > MAX_AVATAR_BYTES || size !== upload.expectedSize) throw new AppException('VALIDATION_ERROR', 'Avatar size does not match the signed upload', HttpStatus.BAD_REQUEST);
    if (!sniffAvatarImageType(prefix)) throw new AppException('VALIDATION_ERROR', 'Avatar must be a JPEG, PNG, or WebP image', HttpStatus.BAD_REQUEST);
    if (upload.status === 'PENDING') {
      await this.prisma.$transaction([
        this.prisma.avatarUpload.update({ where: { id: upload.id }, data: { status: 'CONFIRMED' } }),
        this.prisma.user.update({ where: { id: userId }, data: { avatarUploadKey: objectKey } }),
      ]);
    }
    await this.queue.enqueue({ userId, objectKey, processedKey: upload.processedKey });
    return { accepted: true };
  }
}
