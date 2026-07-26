import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

type ModuleResolver = (id: string) => string;

const resolveModule: ModuleResolver = createRequire(__filename).resolve;

export const LOGGER_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.phone',
  'req.body.code',
  'req.body.password',
  'req.body.refreshToken',
  'phone',
  'code',
  'password',
  'refreshToken',
] as const;

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function createLoggerConfig(
  level: string,
  isProduction: boolean,
  resolver: ModuleResolver = resolveModule,
): Params {
  if (!isProduction) {
    try {
      resolver('pino-pretty');
    } catch {
      throw new Error(
        `Pretty logging requested with NODE_ENV!=production and LOG_LEVEL=${level}, but pino-pretty is not installed. Use NODE_ENV=production for this image or install pino-pretty.`,
      );
    }
  }

  return {
    pinoHttp: {
      level,
      redact: { paths: [...LOGGER_REDACT_PATHS], censor: '[REDACTED]' },
      genReqId: (request, response): string => {
        const requestId = headerValue(request, 'x-request-id') ?? randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      transport: isProduction ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
    },
  };
}
