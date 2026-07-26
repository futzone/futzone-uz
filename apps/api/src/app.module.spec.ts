import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule dependency wiring', () => {
  it('compiles the complete application module graph', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.close();
  });
});
