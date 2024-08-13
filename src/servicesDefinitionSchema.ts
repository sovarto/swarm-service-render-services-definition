import { z } from 'zod';

const EnvironmentSchema = z.union([
    z.array(z.union([
        z.string(),
        z.record(z.union([ z.string(), z.number(), z.boolean() ]))
    ])),
    z.record(z.string())
]);

const ResourcesLimitsReservationsSchema = z.object({
    memory: z.number().optional(), // in MiB
    cpuShares: z.number().optional() // in 1/1000 CPU shares.
})

const ResourcesSchema = z.object({
    limits: ResourcesLimitsReservationsSchema.optional(),
    reservations: ResourcesLimitsReservationsSchema.optional()
})

const ReplicasSchema = z.object({min: z.number(), max: z.number().optional()}).optional()
const ExternalRouteSchema = z.union([
    z.object({
        port: z.number(),
        subdomain: z.string()
    }),
    z.object({
        port: z.number(),
        domains: z.array(z.string())
    })
]);

const AdditionalServiceDefinitionAdjustmentsSchema = z.object({
    node_type: z.string().optional(),
    replicas: ReplicasSchema.optional(),
    resources: ResourcesSchema.optional(),
    external_route: ExternalRouteSchema.optional()
});

const ServiceDefinitionSchema = z.intersection(z.object({
    image: z.string().optional(),
    environment: EnvironmentSchema.optional(),
}), AdditionalServiceDefinitionAdjustmentsSchema);


export const ServicesDefinitionSchema = z.object({
    services: z.record(z.union([z.null(), ServiceDefinitionSchema]))
});

export type EnvironmentSchema = z.infer<typeof EnvironmentSchema>
export type ServiceDefinitionSchema = z.infer<typeof ServiceDefinitionSchema>
export type ServicesDefinitionSchema = z.infer<typeof ServicesDefinitionSchema>
