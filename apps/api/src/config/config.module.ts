import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateAppConfig, type AppConfig } from './app-config';
import { APP_CONFIG, ConfigService } from './config.service';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true })],
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => validateAppConfig(process.env) },
    ConfigService,
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
