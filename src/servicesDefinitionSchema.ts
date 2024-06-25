import { z } from 'zod';

const EnvironmentSchema = z.union([
    z.array(z.union([
        z.string(),
        z.record(z.union([ z.string(), z.number(), z.boolean() ]))
    ])),
    z.record(z.string())
]);

const ServiceDefinitionSchema = z.object({
    image: z.string().optional(),
    environment: EnvironmentSchema.optional(),
    node_type: z.string().optional()
});

export const ServicesDefinitionSchema = z.object({
    services: z.record(z.union([z.null(), ServiceDefinitionSchema]))
});

export type EnvironmentSchema = z.infer<typeof EnvironmentSchema>
export type ServiceDefinitionSchema = z.infer<typeof ServiceDefinitionSchema>
export type ServicesDefinitionSchema = z.infer<typeof ServicesDefinitionSchema>
