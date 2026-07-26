import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from './app-config';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Injectable()
export class ConfigService {
  public constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}
