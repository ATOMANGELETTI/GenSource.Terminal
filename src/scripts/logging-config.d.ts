export const DEFAULT_LEVELS: {
  error: boolean;
  warn: boolean;
  info: boolean;
  debug: boolean;
  trace: boolean;
  fatal: boolean;
};

export function stripJsonc(raw: string): string;

export interface LoggingLevelSection {
  error: boolean;
  warn: boolean;
  info: boolean;
  debug: boolean;
  trace: boolean;
  fatal: boolean;
}

export interface LoggingConfigFile {
  app: LoggingLevelSection;
  build: LoggingLevelSection;
  agent: LoggingLevelSection & {
    prompts: boolean;
    replies: boolean;
    tools: boolean;
    reasoning: boolean;
  };
}

export function loadLoggingConfig(): LoggingConfigFile;
export function anyLevelEnabled(section: LoggingLevelSection | undefined): boolean;
export function allows(
  section: LoggingLevelSection | undefined,
  level: string,
): boolean;
export function classifyLine(line: string): string;
export function consumeLogChunk(
  carry: string,
  chunk: string | Uint8Array,
  onLine: (line: string, level: string) => void,
): string;
