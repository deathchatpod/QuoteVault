import { z } from 'zod';

const configSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(5000),
  }),
  database: z.object({
    url: z.string().min(1, "DATABASE_URL is required"),
  }),
  session: z.object({
    secret: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  }),
  ai: z.object({
    gemini: z.object({
      apiKey: z.string().min(1, "AI_INTEGRATIONS_GEMINI_API_KEY is required"),
      baseUrl: z.string().url("AI_INTEGRATIONS_GEMINI_BASE_URL must be a valid URL"),
    }),
    anthropic: z.object({
      apiKey: z.string().min(1, "AI_INTEGRATIONS_ANTHROPIC_API_KEY is required"),
      baseUrl: z.string().url("AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be a valid URL"),
    }),
  }),
  replit: z.object({
    connectors: z.object({
      hostname: z.string().optional(),
    }),
    identity: z.string().optional(),
    renewal: z.string().optional(),
  }),
  externalApis: z.object({
    sunnah: z.object({
      apiKey: z.string().optional(),
    }),
    apiNinjas: z.object({
      apiKey: z.string().optional(),
    }),
    celebrityLines: z.object({
      apiKey: z.string().optional(),
    }),
    genius: z.object({
      apiKey: z.string().optional(),
    }),
  }),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const rawConfig = {
    server: {
      port: parseInt(process.env.PORT || '5000', 10),
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    session: {
      secret: process.env.SESSION_SECRET,
    },
    ai: {
      gemini: {
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
      anthropic: {
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseUrl: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      },
    },
    replit: {
      connectors: {
        hostname: process.env.REPLIT_CONNECTORS_HOSTNAME,
      },
      identity: process.env.REPL_IDENTITY,
      renewal: process.env.WEB_REPL_RENEWAL,
    },
    externalApis: {
      sunnah: {
        apiKey: process.env.SUNNAH_API_KEY,
      },
      apiNinjas: {
        apiKey: process.env.API_NINJAS_API_KEY,
      },
      celebrityLines: {
        apiKey: process.env.CELEBRITY_LINES_API_KEY,
      },
      genius: {
        apiKey: process.env.GENIUS_API_KEY,
      },
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error("Invalid configuration. Check environment variables.");
    }
    throw error;
  }
}

export const config = loadConfig();

console.log("✓ Configuration validated successfully");
