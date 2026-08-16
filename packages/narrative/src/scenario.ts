import { z } from 'zod';
import { percentSchema } from '@ag/schemas';

export const scenarioStructuredSchema = z
  .object({
    emotion: z
      .object({
        type: z.string().min(1),
        intensity: percentSchema,
      })
      .strict()
      .optional(),
    intent: z
      .object({
        type: z.string().min(1),
        intensity: percentSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export const generatedScenarioSchema = z
  .object({
    narrative: z.string().min(1),
    structured: scenarioStructuredSchema,
  })
  .strict();

export type ScenarioStructured = z.infer<typeof scenarioStructuredSchema>;
export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;
