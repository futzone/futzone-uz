import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AVATAR_URL_TTL_SECONDS } from './avatar.constants';

@Injectable()
export class AvatarStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  public constructor(config: ConfigService) {
    this.bucket = config.get('S3_BUCKET');
    this.endpoint = config.get('S3_ENDPOINT').replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: this.endpoint, region: config.get('S3_REGION'), forcePathStyle: true,
      credentials: { accessKeyId: config.get('S3_ACCESS_KEY'), secretAccessKey: config.get('S3_SECRET_KEY') },
    });
  }
  public presignPut(key: string, size: number): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentLength: size }), { expiresIn: AVATAR_URL_TTL_SECONDS });
  }
  public async metadata(key: string): Promise<{ size: number }> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { size: result.ContentLength ?? -1 };
  }
  public async prefix(key: string): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: 'bytes=0-15' }));
    if (!result.Body) return new Uint8Array();
    return result.Body.transformToByteArray();
  }
  public async read(key: string): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Avatar object has no body');
    return result.Body.transformToByteArray();
  }
  public async write(key: string, body: Uint8Array): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: 'image/webp' }));
  }
  public async delete(key: string): Promise<void> { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
  public publicUrl(key: string): string { return `${this.endpoint}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`; }
  public keyFromPublicUrl(value: string): string | null {
    const prefix = `${this.endpoint}/${this.bucket}/`;
    if (!value.startsWith(prefix)) return null;
    try { return value.slice(prefix.length).split('/').map(decodeURIComponent).join('/'); } catch { return null; }
  }
}
