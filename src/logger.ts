import pino, { type Logger } from "pino";

export function createLogger(level: pino.LevelWithSilent): Logger {
  return pino({
    level,
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              singleLine: true,
            },
          },
  });
}

