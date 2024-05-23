import * as core from '@actions/core';
import * as yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as tmp from 'tmp';
import { ServicesDefinitionSchema } from './servicesDefinitionSchema';

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const servicesDefinitionFile = core.getInput('services-definition', { required: true });
        const serviceName = core.getInput('service-name', { required: true });
        const image = core.getInput('image', { required: true });
        const environmentVariablesString = core.getInput('environment-variables', { required: false });

        const servicesDefinitionPath = path.isAbsolute(servicesDefinitionFile) ?
                                       servicesDefinitionFile :
                                       path.join(process.env.GITHUB_WORKSPACE!, servicesDefinitionFile);
        if (!fs.existsSync(servicesDefinitionPath)) {
            throw new Error(`Services definition file does not exist: ${ servicesDefinitionFile }`);
        }

        const servicesDefinition = validateInput(servicesDefinitionPath);

        if (!(serviceName in servicesDefinition.services)) {
            throw new Error(`Couldn't find service '${ serviceName }' in services definition file '${ servicesDefinitionPath }'`);
        }

        const serviceDefinition = servicesDefinition.services[serviceName] || {}; // It's null, if only the service
                                                                                  // name was specified in the services
                                                                                  // definition file and nothing else
        serviceDefinition.image = image;

        if (!serviceDefinition.environment) {
            serviceDefinition.environment = [];
        }

        const environmentVariables = parseEnvironmentVariablesString(environmentVariablesString || '');

        const normalizedEnvironmentVariables = normalizeServiceDefinitionEnvironment(serviceDefinition.environment);
        const unusedEnvVars = ensureAllEnvironmentVariables(normalizedEnvironmentVariables, environmentVariables);

        let env = Object.entries(normalizedEnvironmentVariables)
                        .reduce<Record<string, string>>((acc, [ name, value ]) => {
                            acc[name] = replaceEnvVars(value, environmentVariables);
                            return acc;
                        }, {});

        env = Object.entries(environmentVariables)
                    .filter(([ name ]) => unusedEnvVars.has(name))
                    .reduce((acc, [ name, value ]) => {
                        acc[name] = value;
                        return acc;
                    }, env);

        serviceDefinition.environment = env;

        const updatedServicesDefinitionFilePath = tmp.fileSync({
            tmpdir: process.env.RUNNER_TEMP,
            prefix: 'services-definition-',
            postfix: '.yaml',
            keep: true,
            discardDescriptor: true
        });

        fs.writeFileSync(updatedServicesDefinitionFilePath.name, yaml.dump(servicesDefinition, { forceQuotes: true }));
        core.setOutput('services-definition', updatedServicesDefinitionFilePath.name);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed(`Unknown error of type '${ typeof error }${ typeof error === 'object'
                                                                       ? ` / ${ error!.constructor.name }`
                                                                       : '' }' occurred:\n\n${error}`);
        }
    }
}

function validateInput(servicesDefinitionPath: string): ServicesDefinitionSchema {
    let input: unknown;
    try {
        input = yaml.load(fs.readFileSync(servicesDefinitionPath, 'utf-8'));
    } catch (error) {
        throw new Error(`Error parsing services-definition file: Invalid YAML.

${ error }`);
    }
    try {
        ServicesDefinitionSchema.parse(input);
    } catch (error) {
        throw new Error(`Error parsing services-definition file: Invalid structure.

${ error }`);
    }
    // We use Zod to parse and validate the input, but we've defined only a subset of the
    // services-definition template file in the Zod schema, because we don't care about the
    // rest in this action.
    // However, Zod's parse function removes all unknown properties, so we just return the given
    // input unchanged, if it successfully passes the parse call.
    return input as ServicesDefinitionSchema;
}

function ensureAllEnvironmentVariables(environmentVariablesDefinition: Record<string, string>,
                                       environmentVariables: Record<string, string>) {
    const usedEnvVars = new Set(Object.values(environmentVariablesDefinition).flatMap(getUsedEnvVars));

    const missingEnvVariables = Array.from(usedEnvVars).filter(x => !(x in environmentVariables));
    if (missingEnvVariables.length) {
        throw new Error(
            `Some environment variables are being used but have not been passed: ${ missingEnvVariables.join(', ') }`);
    }

    return new Set(Object.entries(environmentVariables).map(([ key ]) => key).filter(x => !usedEnvVars.has(x)));
}

function getUsedEnvVars(str: string): string[] {
    const regex = /\$\{?(\w+)}?/g;
    const matches = str.match(regex) || [];
    return Array.from(new Set(matches.map(match => match.replace(/\$\{?(\w+)}?/, '$1'))));
}

function replaceEnvVars(str: string, env: Record<string, string>): string {
    const regex = /\$\{?(\w+)}?/g;
    return str.replace(regex, (match, varName) => {
        return env[varName] ?? match;
    });
}

function parseEnvironmentVariablesString(environmentVariablesString: string) {
    const items = environmentVariablesString.split('\n').map(x => x.trim()).filter(x => !!x.length)
                                            .map(x => x.split('='));
    const invalidLines = items.filter(x => x.length === 1);
    if (invalidLines.length) {
        throw new Error(`Invalid environment variables received. Environment variables need to be lines of the form NAME=value. The following lines are invalid:\n${ invalidLines.join(
            '\n') }`);
    }

    return items.reduce<Record<string, string>>((acc, [ name, ...valueParts ]) => {
        if (acc[name]) {
            throw new Error(`The environment variable '${ name }' was specified multiple times in the action inputs`);
        }
        acc[name] = valueParts.join('=');
        return acc;
    }, {});
}

function normalizeServiceDefinitionEnvironment(environment: Record<string, string> | (string | Record<string, string | number | boolean>)[]) {
    if (Array.isArray(environment)) {
        return environment.reduce<Record<string, string>>((acc, curr) => {
            if (typeof curr === 'string') {
                if (acc[curr]) {
                    throw new Error(`The environment variable '${ curr }' was specified multiple times in the service definition`);
                }
                acc[curr] = `$${ curr }`;
            } else {
                for (const [ name, value ] of Object.entries(curr)) {
                    if (acc[name]) {
                        throw new Error(`The environment variable '${ name }' was specified multiple times in the service definition`);
                    }

                    acc[name] = `${ value }`;
                }
            }

            return acc;
        }, {});
    } else {
        return environment;
    }
}

