import { Injectable } from '@nestjs/common';
import type { ProcessAvatarJobPayload } from '@futzone/contracts';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarStorageService } from './avatar-storage.service';

@Injectable()
export class AvatarProcessorService {
  public constructor(private readonly prisma: PrismaService, private readonly storage: AvatarStorageService) {}
  public async process(payload: ProcessAvatarJobPayload): Promise<void> {
    const upload = await this.prisma.avatarUpload.findUnique({ where: { objectKey: payload.objectKey }, select: { previousAvatarKey: true } });
    if (!upload) return;
    const user = await this.prisma.user.findUnique({ where: { id: payload.userId }, select: { avatarUrl: true, avatarUploadKey: true } });
    if (!user) return;
    const processedUrl = this.storage.publicUrl(payload.processedKey);
    if (user.avatarUrl === processedUrl && user.avatarUploadKey === null) {
      await this.storage.delete(payload.objectKey);
      if (upload.previousAvatarKey && upload.previousAvatarKey !== payload.processedKey) await this.storage.delete(upload.previousAvatarKey);
      return;
    }
    if (user.avatarUploadKey !== payload.objectKey) return;
    const input = await this.storage.read(payload.objectKey);
    const output = await sharp(input).rotate().resize(512, 512, { fit: 'cover', position: 'centre' }).webp({ quality: 85 }).toBuffer();
    await this.storage.write(payload.processedKey, output);
    const previousAvatarKey = user.avatarUrl ? this.storage.keyFromPublicUrl(user.avatarUrl) : null;
    let replaced = false;
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({ where: { id: payload.userId, avatarUploadKey: payload.objectKey }, data: { avatarUrl: processedUrl, avatarUploadKey: null } });
      if (updated.count === 0) return;
      await transaction.avatarUpload.update({ where: { objectKey: payload.objectKey }, data: { status: 'COMPLETED', previousAvatarKey } });
      replaced = true;
    });
    if (!replaced) { await this.storage.delete(payload.processedKey); return; }
    await this.storage.delete(payload.objectKey);
    if (previousAvatarKey && previousAvatarKey !== payload.processedKey) await this.storage.delete(previousAvatarKey);
  }
}
