import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as tmp from 'tmp';
import { run } from '../src/main';

jest.mock('@actions/core');
jest.mock('tmp');
jest.mock('node:fs', () => ({
    promises: {
        access: jest.fn()
    },
    constants: {
        O_CREATE: jest.fn()
    },
    rmdirSync: jest.fn(),
    existsSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn()
}));

describe('Render services definition', () => {

    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();

        process.env = { ...originalEnv };
        process.env = Object.assign(process.env, { GITHUB_WORKSPACE: __dirname });
        process.env = Object.assign(process.env, { RUNNER_TEMP: '/home/runner/work/_temp' });

    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test(
        'renders the services definition and creates a new services definition file, keeps other services unchanged and returns other properties',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce('web')                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce('FOO=bar\nHELLO=world\nDONT=panic'); // environment-variables

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    environment:
      - FOO
      - SOMETHING_ELSE: Hello $HELLO! Hello \${HELLO}.
    external_route:
      subdomain: 'web'
      port: 1234
  backend:
    environment:
      - FOO
      - HELLO
      - SOMETHING_ELSE: $DONT or \${DONT}
    health_check:
      path: '/'
      port: 5678
`);

            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    environment:
      FOO: 'bar'
      SOMETHING_ELSE: 'Hello world! Hello world.'
      DONT: 'panic'
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
  backend:
    environment:
      - 'FOO'
      - 'HELLO'
      - SOMETHING_ELSE: '$DONT or \${DONT}'
    health_check:
      path: '/'
      port: 5678
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('renders a services definition at an absolute path, and with initial environment empty', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce('web')                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce('FOO=bar\nHELLO=world\nDONT=panic'); // environment-variables

        const mockFileSync = tmp.fileSync as jest.Mock;
        mockFileSync.mockReturnValue({
            name: 'new-services-definition-file-name'
        });

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);

        await run();

        expect(core.setFailed).not.toHaveBeenCalled();

        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'services-definition-',
            postfix: '.yaml',
            keep: true,
            discardDescriptor: true
        });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
            `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    environment:
      FOO: 'bar'
      HELLO: 'world'
      DONT: 'panic'
`);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
    });

    test(
        'renders the services definition with initially empty environment block and environment values loaded from default',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce('web')                  // service-name
                        .mockReturnValueOnce('nginx:latest');         // image

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);

            process.env.SERVICE_DEFINITION_ENVIRONMENT_VARIABLES = 'FOO=f00\nBAR=b4r';

            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    environment:
      FOO: 'f00'
      BAR: 'b4r'
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('renders a services definition with environments as an object', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce('web')                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce('FOO=bar\nHELLO=world\nDONT=panic'); // environment-variables

        const mockFileSync = tmp.fileSync as jest.Mock;
        mockFileSync.mockReturnValue({
            name: 'new-services-definition-file-name'
        });

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
    environment:
      A: $FOO
      B: $HELLO
    external_route:
      subdomain: 'web'
      port: 1234
`);

        await run();

        expect(core.setFailed).not.toHaveBeenCalled();

        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'services-definition-',
            postfix: '.yaml',
            keep: true,
            discardDescriptor: true
        });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
            `services:
  web:
    environment:
      A: 'bar'
      B: 'world'
      DONT: 'panic'
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
`);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
    });

    test('renders a services definition with unspecified but available environments', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce('web')                  // service-name
                    .mockReturnValueOnce('nginx:latest');         // image

        const mockFileSync = tmp.fileSync as jest.Mock;
        mockFileSync.mockReturnValue({
            name: 'new-services-definition-file-name'
        });

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
    environment:
      - A
    external_route:
      subdomain: 'web'
      port: 1234
`);

        process.env.A = 'bar';

        await run();

        expect(core.setFailed).not.toHaveBeenCalled();

        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'services-definition-',
            postfix: '.yaml',
            keep: true,
            discardDescriptor: true
        });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
            `services:
  web:
    environment:
      A: 'bar'
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
`);
        expect(core.setOutput).toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
    });

    test('renders a services definition with environment variables input as json and marks sensitive ones as secret',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce('web')                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(JSON.stringify([
                            { name: 'FOO', value: 'f00', sensitive: true },
                            { name: 'BAR', value: 'b4r' }
                        ]));

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    environment:
      FOO: 'f00'
      BAR: 'b4r'
`);
            expect(core.setSecret).toHaveBeenNthCalledWith(1, 'f00');
            expect(core.setSecret).toHaveBeenCalledTimes(1);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('adds node type to service definition if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce('web')                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce('')
                        .mockReturnValueOnce('appInfrastructureNode');

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    node_type: 'appInfrastructureNode'
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('renders a services with only min replicas if specified',
        async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce('2'); // replicas-min

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
        await run();

        expect(core.setFailed).not.toHaveBeenCalled();

        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'services-definition-',
            postfix: '.yaml',
            keep: true,
            discardDescriptor: true
        });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
            `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    replicas:
      min: 2
`);
        expect(core.setOutput)
            .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
    });

    test('renders a services with min and max replicas if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce('2')  // replicas-min
                        .mockReturnValueOnce('5'); // replicas-max

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    replicas:
      min: 2
      max: 5
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('renders a services definition with a single service when no service-name was specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest');         // image

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1, 'services-definition', 'new-services-definition-file-name');
        });

    test('renders a services with CPU reservation if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce(undefined)  // replicas-min
                        .mockReturnValueOnce(undefined) // replicas-max
                        .mockReturnValueOnce(500);  // resources-reservations-cpu

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    resources:
      reservations:
        cpuShares: 500
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1,
                    'services-definition',
                    'new-services-definition-file-name');
        });

    test('renders a services with resource reservations and limits if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce(undefined)  // replicas-min
                        .mockReturnValueOnce(undefined) // replicas-max
                        .mockReturnValueOnce(500)  // resources-reservations-cpu
                        .mockReturnValueOnce(512)  // resources-reservations-memory
                        .mockReturnValueOnce(1000)  // resources-limits-cpu
                        .mockReturnValueOnce(1024);  // resources-limits-memory

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    resources:
      reservations:
        cpuShares: 500
        memory: 512
      limits:
        cpuShares: 1000
        memory: 1024
`);
        });

    test('renders a services with memory reservation if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce(undefined)  // replicas-min
                        .mockReturnValueOnce(undefined) // replicas-max
                        .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                        .mockReturnValueOnce(512);  // resources-reservations-memory

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    resources:
      reservations:
        memory: 512
`);
            expect(core.setOutput)
                .toHaveBeenNthCalledWith(1,
                    'services-definition',
                    'new-services-definition-file-name');
        });


    test('renders a services with CPU limit if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce(undefined)  // replicas-min
                        .mockReturnValueOnce(undefined) // replicas-max
                        .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                        .mockReturnValueOnce(undefined)  // resources-reservations-memory
                        .mockReturnValueOnce(1000);  // resources-limits-cpu

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync)
                .toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                    `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    resources:
      limits:
        cpuShares: 1000
`);
        });

    test('renders a services with memory limit if specified',
        async () => {
            const mockGetInput = core.getInput as jest.Mock;
            mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                        .mockReturnValueOnce(undefined)                  // service-name
                        .mockReturnValueOnce('nginx:latest')         // image
                        .mockReturnValueOnce(undefined) // env
                        .mockReturnValueOnce(undefined) // node-type
                        .mockReturnValueOnce(undefined)  // replicas-min
                        .mockReturnValueOnce(undefined) // replicas-max
                        .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                        .mockReturnValueOnce(undefined)  // resources-reservations-memory
                        .mockReturnValueOnce(undefined)  // resources-limits-cpu
                        .mockReturnValueOnce(1024);  // resources-limits-memory

            const mockFileSync = tmp.fileSync as jest.Mock;
            mockFileSync.mockReturnValue({
                name: 'new-services-definition-file-name'
            });

            const mockExistsSync = fs.existsSync as jest.Mock;
            mockExistsSync.mockReturnValue(true);

            const mockReadFileSync = fs.readFileSync as jest.Mock;
            mockReadFileSync.mockReturnValue(`
services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
`);
            await run();

            expect(core.setFailed).not.toHaveBeenCalled();

            expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
                tmpdir: '/home/runner/work/_temp',
                prefix: 'services-definition-',
                postfix: '.yaml',
                keep: true,
                discardDescriptor: true
            });
            expect(fs.writeFileSync)
                .toHaveBeenNthCalledWith(1, 'new-services-definition-file-name',
                    `services:
  web:
    external_route:
      subdomain: 'web'
      port: 1234
    image: 'nginx:latest'
    resources:
      limits:
        memory: 1024
`);
        });

    test('error returned if only max replicas is specified', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce(undefined)  // replicas-min
                    .mockReturnValueOnce('5'); // replicas-max

        await run();

        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'If replicas-max is specified, replicas-min needs to be specified as well');
    });

    test('error returned if resources-reservations-cpu is not a number', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce(undefined)  // replicas-min
                    .mockReturnValueOnce(undefined)  // replicas-max
                    .mockReturnValueOnce('a')  // resources-reservations-cpu

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for resources-reservations-cpu. Got 'a'.`);
    });

    test('error returned if resources-reservations-memory is not a number', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce(undefined)  // replicas-min
                    .mockReturnValueOnce(undefined)  // replicas-max
                    .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                    .mockReturnValueOnce('a')  // resources-reservations-memory

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for resources-reservations-memory. Got 'a'.`);
    });

    test('error returned if resources-limits-cpu is not a number', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce(undefined)  // replicas-min
                    .mockReturnValueOnce(undefined)  // replicas-max
                    .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                    .mockReturnValueOnce(undefined)  // resources-reservations-memory
                    .mockReturnValueOnce('a')  // resources-limits-cpu

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for resources-limits-cpu. Got 'a'.`);
    });

    test('error returned if resources-limits-memory is not a number', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce(undefined)  // replicas-min
                    .mockReturnValueOnce(undefined)  // replicas-max
                    .mockReturnValueOnce(undefined)  // resources-reservations-cpu
                    .mockReturnValueOnce(undefined)  // resources-reservations-memory
                    .mockReturnValueOnce(undefined)  // resources-limits-cpu
                    .mockReturnValueOnce('a')  // resources-limits-memory

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for resources-limits-memory. Got 'a'.`);
    });

    test('error returned if min replicas is not a number', async () => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce('a');  // replicas-min

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for replicas-min. Got 'a'.`);
    });

    test('error returned if max replicas is not a number', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce(undefined)                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce(undefined) // env
                    .mockReturnValueOnce(undefined) // node-type
                    .mockReturnValueOnce('2')  // replicas-min
                    .mockReturnValueOnce('a');  // replicas-max
        await run();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(core.setFailed)
            .toHaveBeenCalledWith(
                `Need to specify a number for replicas-max. Got 'a'.`);
    });

    test('error returned for missing service-name when multiple services exist', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
  db:
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('missing-environment-variable-services-definition.tmpl.yaml')
                    .mockReturnValueOnce(undefined)
                    .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'Multiple services exist in definition file but no service-name was specified');
    });

    test('error returned for missing environment variable', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
    environment:
      - NOT_PROVIDED
      - BAZ: $ALSO_NOT_PROVIDED
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('missing-environment-variable-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'Some environment variables are being used but have not been passed: NOT_PROVIDED, ALSO_NOT_PROVIDED');
    });

    test('error returned for invalid environment variables input', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('missing-environment-variable-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest')
                    .mockReturnValueOnce('FOO=bar\nBAZ');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'Invalid environment variables received. Input \'environment-variables\' needs to be valid JSON or it needs to be lines of the form NAME=value. The following lines are invalid:\nBAZ');
    });

    test('error returned for same environment variable multiple times in input', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  web:
`);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('duplicate-environment-variable-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest')
                    .mockReturnValueOnce('FOO=bar\nFOO=baz');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'The environment variable \'FOO\' was specified multiple times in the action inputs');
    });

    test.each([
        [
            `services:
  web:
    environment:
      - FOO: bar
      - FOO`
        ], [
            `services:
  web:
    environment:
      - FOO
      - FOO: baz`
        ]
    ])('error returned for same environment variable multiple times in services definition', async (fileContent) => {
        console.log(fileContent);
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(fileContent);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('duplicate-environment-variable-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest')
                    .mockReturnValueOnce('FOO=baz');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'The environment variable \'FOO\' was specified multiple times in the service definition');
    });

    test('error returned for missing services definition file', async () => {
        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(false);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('does-not-exist-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(
                'Services definition file does not exist: does-not-exist-services-definition.tmpl.yaml');
    });

    test('error returned for non-YAML services definition contents', async () => {
        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue('a: b: c');

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('non-yaml-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(expect.stringContaining('Error parsing services-definition file: Invalid YAML.'));
    });

    test('error returned for malformed services definition', async () => {
        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(
            `service:
  web`);

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('malformed-services-definition.tmpl.yaml')
                    .mockReturnValueOnce('web')
                    .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(expect.stringContaining('Error parsing services-definition file: Invalid structure.'));
    });

    test('error returned for services definition without matching service name', async () => {

        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockReturnValueOnce('missing-service-services-definition.tmpl.yaml') // services-definition
                    .mockReturnValueOnce('web')                  // service-name
                    .mockReturnValueOnce('nginx:latest')         // image
                    .mockReturnValueOnce('FOO=bar\nHELLO=world\nDONT=panic'); // environment-variables

        const mockExistsSync = fs.existsSync as jest.Mock;
        mockExistsSync.mockReturnValue(true);

        const mockReadFileSync = fs.readFileSync as jest.Mock;
        mockReadFileSync.mockReturnValue(`
services:
  nginx:
    external_route:
      subdomain: 'web'
      port: 1234
`);

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(expect.stringContaining(`Couldn't find service 'web' in services definition file`));
    });

    test.each([
        [ 'Not derived from Error', 'string' ],
        [ { error: 'Also not derived from Error' }, 'object / Object' ],
        [ new Date(), 'object / Date' ]
    ])('Properly handles errors that are not derived from Error', async (error, expectedType) => {
        const mockGetInput = core.getInput as jest.Mock;
        mockGetInput.mockImplementation(() => {throw error;});

        await run();

        expect(core.setFailed)
            .toHaveBeenCalledWith(`Unknown error of type '${ expectedType }' occurred:\n\n${ error }`);
    });
})
;
