import { z } from "zod";

export const creatorOptionsSchema = z.object({
  classOptions: z.record(
    z.string(),
    z.object({
      armor: z.array(z.string()),
      weapons: z.array(z.string()),
      tools: z.array(z.string()),
      languages: z.array(z.string()),
      skillChoices: z.array(z.string()),
      recommendedSkills: z.array(z.string()),
      skillChoiceCount: z.number().int().positive(),
    }),
  ),
  speciesOptions: z.record(
    z.string(),
    z.object({
      languages: z.array(z.string()),
      toolChoices: z.array(z.string()),
      notes: z.string(),
    }),
  ),
  backgroundOptions: z.record(
    z.string(),
    z.object({
      languages: z.array(z.string()),
      tools: z.array(z.string()),
      skillProficiencies: z.array(z.string()),
    }),
  ),
});

export type CreatorOptions = z.infer<typeof creatorOptionsSchema>;
