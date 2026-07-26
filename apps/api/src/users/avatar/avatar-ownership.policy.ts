import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

@Injectable()
export class AvatarOwnershipPolicy {
  public assertObjectBelongsToUser(userId: string, objectKey: string): void {
    if (!objectKey.startsWith(`users/${userId}/avatar-uploads/`)) throw new AppException('FORBIDDEN', 'Avatar object does not belong to user', HttpStatus.FORBIDDEN);
  }
}
