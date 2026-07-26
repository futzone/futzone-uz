import { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@futzone/contracts';

export class AppException extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppException';
  }
}
